from __future__ import annotations

from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - type hints only
    from .jobs import Job, JobStatus

JOBS: Dict[str, 'Job'] = {}


async def add_job(job_id: str, job: 'Job') -> None:
    JOBS[job_id] = job


async def get_job(job_id: str) -> Optional['Job']:
    return JOBS.get(job_id)


async def update_job_status(job_id: str, status: 'JobStatus', **updates: str | None) -> None:
    job = JOBS.get(job_id)
    if not job:
        return
    job.status = status
    for key, value in updates.items():
        setattr(job, key, value)


async def list_jobs() -> Dict[str, 'Job']:
    return JOBS.copy()


def init(_: object | None = None) -> None:
    """No-op init to match redis backend."""
    return None
