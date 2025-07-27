from __future__ import annotations

import asyncio
import threading
from datetime import datetime, timezone

from .jobs import JobStatus
from .state import get_job, update_job_status
from ..queue import dequeue_job
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


async def _worker_loop(stop_event: threading.Event | None = None) -> None:
    while True:
        if stop_event and stop_event.is_set():
            break
        item = await dequeue_job()
        if not item:
            await asyncio.sleep(0.1)
            continue
        await _compile_job_async(item['job_id'])
_STOP: threading.Event | None = None
_THREAD: threading.Thread | None = None


def start_worker() -> None:
    global _STOP, _THREAD
    if _THREAD is not None:
        return
    _STOP = threading.Event()
    _THREAD = threading.Thread(target=lambda: asyncio.run(_worker_loop(_STOP)), daemon=True)
    _THREAD.start()


def stop_worker() -> None:
    if _STOP:
        _STOP.set()
    if _THREAD:
        _THREAD.join(timeout=1)
