from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class JobStatus(str, Enum):
    PENDING = 'PENDING'
    RUNNING = 'RUNNING'
    SUCCEEDED = 'SUCCEEDED'
    FAILED = 'FAILED'


@dataclass
class Job:
    id: str
    owner: str
    status: JobStatus = JobStatus.PENDING
    pdf_path: str | None = None
    log: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
