from __future__ import annotations

from datetime import datetime
from typing import Optional, cast, Dict
import json
import os

import redis

from .models import Job, JobStatus, Project
from .settings import TESTING, REDIS_URL

if TESTING:
    import fakeredis
    _REDIS: redis.Redis = fakeredis.FakeRedis(decode_responses=True)
else:
    _REDIS: redis.Redis = redis.StrictRedis.from_url(REDIS_URL)
_PREFIX = 'job:'
STATUS_CHANNEL = 'collatex:job_status'
PROJECT_KEY = 'collatex:projects'


def init(client: redis.Redis) -> None:
    global _REDIS
    if os.getenv('COLLATEX_USE_REDISLITE'):
        import redislite  # type: ignore

        _REDIS = redislite.StrictRedis()
    else:
        _REDIS = client


def create_project(project: Project) -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    _REDIS.hset(PROJECT_KEY, project.token, project.created_at.isoformat())


def get_project(token: str) -> Optional[Project]:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    created = _REDIS.hget(PROJECT_KEY, token)
    if not created:
        return None
    return Project(token=token, created_at=datetime.fromisoformat(created.decode()))


def get_job(job_id: str) -> Optional[Job]:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    data = cast(Dict[bytes, bytes], _REDIS.hgetall(f'{_PREFIX}{job_id}'))
    if not data:
        return None
    return Job(
        id=job_id,
        project_token=data[b'project_token'].decode(),
        status=JobStatus(data[b'status'].decode()),
        pdf_path=(data.get(b'pdf_path') or b'').decode() or None,
        log=(data.get(b'log') or b'').decode() or None,
        created_at=datetime.fromisoformat(data[b'created_at'].decode()),
    )


def save_job(job: Job, ttl: int = 604800) -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    mapping = {
        'project_token': job.project_token,
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
    payload = json.dumps({'id': job.id, 'status': job.status.value, 'project': job.project_token})
    _REDIS.publish(STATUS_CHANNEL, payload)
