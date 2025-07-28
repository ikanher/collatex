from __future__ import annotations

from datetime import datetime
from typing import Optional, cast, Dict
import json

import redis

from .models import Job, JobStatus

_REDIS: redis.Redis | None = None
_PREFIX = 'job:'
STATUS_CHANNEL = 'collatex:job_status'


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
        owner=data[b'owner'].decode(),
        status=JobStatus(data[b'status'].decode()),
        pdf_path=(data.get(b'pdf_path') or b'').decode() or None,
        log=(data.get(b'log') or b'').decode() or None,
        created_at=datetime.fromisoformat(data[b'created_at'].decode()),
    )


def save_job(job: Job, ttl: int = 604800) -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    mapping = {
        'owner': job.owner,
        'status': job.status.value,
        'created_at': job.created_at.isoformat(),
    }
    if job.pdf_path:
        mapping['pdf_path'] = job.pdf_path
    if job.log:
        mapping['log'] = job.log
    _REDIS.hset(f'{_PREFIX}{job.id}', mapping=mapping)
    _REDIS.expire(f'{_PREFIX}{job.id}', ttl)


def publish_status(job: Job) -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    payload = json.dumps({'id': job.id, 'status': job.status.value})
    _REDIS.publish(STATUS_CHANNEL, payload)
