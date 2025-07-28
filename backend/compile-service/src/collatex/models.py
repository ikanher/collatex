from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class JobStatus(str, Enum):
    PENDING = 'PENDING'
    RUNNING = 'RUNNING'
    SUCCEEDED = 'SUCCEEDED'
    FAILED = 'FAILED'


class Project(BaseModel):
    token: str
    created_at: datetime


@dataclass
class Job:
    id: str
    project_token: str
    status: JobStatus = JobStatus.PENDING
    pdf_path: str | None = None
    log: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
