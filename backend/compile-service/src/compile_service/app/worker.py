from __future__ import annotations

import threading

from .jobs import JOB_QUEUE
from .state import get_job
from structlog.contextvars import bind_contextvars, unbind_contextvars

from ..logging import job_id_var
from ..executor import run_compile


def _compile_job(job_id: str) -> None:
    job = get_job(job_id)
    if not job:
        return
    token = job_id_var.set(job_id)
    bind_contextvars(job_id=job_id)
    try:
        run_compile(job)
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
