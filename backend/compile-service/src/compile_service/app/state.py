from __future__ import annotations

from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - type hints only
    from .jobs import Job, JobStatus

JOBS: Dict[str, 'Job'] = {}


def add_job(job_id: str, job: 'Job') -> None:
    JOBS[job_id] = job


def get_job(job_id: str) -> Optional['Job']:
    return JOBS.get(job_id)


def update_job_status(job_id: str, status: 'JobStatus', **updates: str | None) -> None:
    job = JOBS.get(job_id)
    if not job:
        return
    job.status = status
    for key, value in updates.items():
        setattr(job, key, value)
