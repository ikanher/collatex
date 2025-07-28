from __future__ import annotations

from datetime import datetime
from typing import Optional, cast, Dict

import redis

from .models import Job, JobStatus

_REDIS: redis.Redis | None = None
_PREFIX = 'job:'


def init(client: redis.Redis) -> None:
    global _REDIS
    _REDIS = client


def get_job(job_id: str) -> Optional[Job]:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    data = cast(Dict[bytes, bytes], _REDIS.hgetall(f'{_PREFIX}{job_id}'))
    if not data:
        return None
    return Job(
        id=job_id,
        status=JobStatus(data[b'status'].decode()),
        pdf_path=(data.get(b'pdf_path') or b'').decode() or None,
        log=(data.get(b'log') or b'').decode() or None,
        created_at=datetime.fromisoformat(data[b'created_at'].decode()),
    )


def save_job(job: Job, ttl: int = 604800) -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    mapping = {
        'status': job.status.value,
        'created_at': job.created_at.isoformat(),
    }
    if job.pdf_path:
        mapping['pdf_path'] = job.pdf_path
    if job.log:
        mapping['log'] = job.log
    _REDIS.hset(f'{_PREFIX}{job.id}', mapping=mapping)
    _REDIS.expire(f'{_PREFIX}{job.id}', ttl)
