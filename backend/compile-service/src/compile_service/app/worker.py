from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from .jobs import JOB_QUEUE, JOBS, JobStatus


def _worker_loop() -> None:
    while True:
        job_id = JOB_QUEUE.get()
        job = JOBS.get(job_id)
        if not job:
            JOB_QUEUE.task_done()
            continue
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc).isoformat()
        time.sleep(0.25)
        job.status = JobStatus.DONE
        job.finished_at = datetime.now(timezone.utc).isoformat()
        JOB_QUEUE.task_done()


def start_worker() -> None:
    thread = threading.Thread(target=_worker_loop, daemon=True)
    thread.start()
