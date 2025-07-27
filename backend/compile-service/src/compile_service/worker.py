from __future__ import annotations

import asyncio
import os
import signal
from datetime import datetime, timezone

import redis.asyncio as redis
from structlog import get_logger
from structlog.contextvars import bind_contextvars, unbind_contextvars
from prometheus_client import Counter
from typing import Any, Dict, cast

from .app.jobs import JobStatus
from .app.state import get_job, update_job_status, init as state_init
from .executor import run_compile
from .logging import configure_logging, job_id_var
from .queue import dequeue_job, init as queue_init

logger = get_logger(__name__)

WORKER_COUNTER = Counter(
    'collatex_worker_jobs_total',
    'Total jobs processed by worker',
    labelnames=['result'],
)


def _result_label(job: 'JobStatus', error: str | None) -> str:
    if job == JobStatus.DONE:
        return 'done'
    if error == 'resource limit exceeded':
        return 'limit'
    return 'error'


async def _process(item: Dict[str, Any]) -> None:
    job_id = item['job_id']
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
        result = _result_label(job.status, job.error)
        WORKER_COUNTER.labels(result=result).inc()
    finally:
        job_id_var.reset(token)
        unbind_contextvars('job_id')


async def _run(stop: asyncio.Event) -> None:
    while not stop.is_set():
        item = await dequeue_job()
        if item is None:
            continue
        await _process(item)


async def main() -> None:
    configure_logging()
    if os.getenv('COLLATEX_STATE', 'memory') == 'redis':
        url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        client = cast(redis.Redis, redis.from_url(url))  # type: ignore[no-untyped-call]
        await client.ping()
        state_init(client)
        queue_init(client)
    else:
        state_init(None)
    stop = asyncio.Event()

    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGTERM, stop.set)

    await _run(stop)

if __name__ == '__main__':
    asyncio.run(main())
