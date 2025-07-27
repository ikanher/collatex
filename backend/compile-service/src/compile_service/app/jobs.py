from __future__ import annotations

import queue
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from .models import CompileRequest
from .state import add_job


class JobStatus(str, Enum):
    QUEUED = 'queued'
    RUNNING = 'running'
    DONE = 'done'
    ERROR = 'error'


@dataclass(kw_only=True)
class Job:
    req: CompileRequest
    status: JobStatus = JobStatus.QUEUED
    queued_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    pdf_path: Optional[str] = None
    logs: Optional[str] = None


JOB_QUEUE: queue.Queue[str] = queue.Queue()


def enqueue(req: CompileRequest) -> str:
    job_id = str(uuid.uuid4())
    add_job(job_id, Job(req=req))
    JOB_QUEUE.put(job_id)
    return job_id
