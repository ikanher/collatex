from __future__ import annotations

import threading
import asyncio

from datetime import datetime, timezone

from .jobs import JOB_QUEUE, JobStatus
from .state import get_job, update_job_status
from structlog.contextvars import bind_contextvars, unbind_contextvars

from ..logging import job_id_var
from ..executor import run_compile


def _compile_job(job_id: str) -> None:
    asyncio.run(_compile_job_async(job_id))


async def _compile_job_async(job_id: str) -> None:
    job = await get_job(job_id)
    if not job:
        return
    token = job_id_var.set(job_id)
    bind_contextvars(job_id=job_id)
    try:
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc).isoformat()
        await update_job_status(job_id, JobStatus.RUNNING, started_at=job.started_at)
        run_compile(job)
        await update_job_status(
            job_id,
            job.status,
            finished_at=job.finished_at,
            error=job.error,
            pdf_bytes=job.pdf_bytes,
        )
    finally:
        job_id_var.reset(token)
        unbind_contextvars('job_id')


def _worker_loop() -> None:
    while True:
        job_id = JOB_QUEUE.get()
        try:
            _compile_job(job_id)
        finally:
            JOB_QUEUE.task_done()


def start_worker() -> None:
    thread = threading.Thread(target=_worker_loop, daemon=True)
    thread.start()
