from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from .models import CompileRequest
from .state import add_job
from ..queue import enqueue_job as _enqueue_job


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
    pdf_bytes: Optional[bytes] = None
    pdf_path: Optional[str] = None
    compile_log: Optional[str] = None


async def enqueue(req: CompileRequest) -> str:
    job_id = str(uuid.uuid4())
    await add_job(job_id, Job(req=req))
    await _enqueue_job(job_id, req.model_dump_json())
    return job_id
