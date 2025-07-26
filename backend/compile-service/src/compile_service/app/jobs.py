import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional
from .models import CompileRequest

@dataclass
class Job:
    status: str = 'queued'
    queued_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    pdf_path: Optional[str] = None

JOBS: Dict[str, Job] = {}

def enqueue(req: CompileRequest) -> str:
    job_id = str(uuid.uuid4())
    job = Job()
    # Stub: complete immediately until compiler is wired
    job.status = 'done'
    job.started_at = job.queued_at
    job.finished_at = job.queued_at
    JOBS[job_id] = job
    return job_id
