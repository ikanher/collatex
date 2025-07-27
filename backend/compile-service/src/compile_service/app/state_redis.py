from __future__ import annotations

import base64
from datetime import timedelta
from typing import Dict, Optional, TYPE_CHECKING, Any, cast

import redis.asyncio as redis

if TYPE_CHECKING:  # pragma: no cover
    from .jobs import Job, JobStatus

_REDIS: redis.Redis | None = None
_PREFIX = 'job:'
_PDF_TTL = timedelta(days=1).seconds


def init(client: redis.Redis) -> None:
    global _REDIS
    _REDIS = client


async def add_job(job_id: str, job: 'Job') -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    _ = await cast(Any, _REDIS.hset(
        f'{_PREFIX}{job_id}',
        mapping={
            'status': job.status.value,
            'queued_at': job.queued_at,
            'metadata': job.req.model_dump_json(),
        },
    ))


async def get_job(job_id: str) -> Optional['Job']:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    data = await cast(Any, _REDIS.hgetall(f'{_PREFIX}{job_id}'))
    if not data:
        return None
    strmap = {k.decode(): v.decode() for k, v in data.items()}
    from .models import CompileRequest
    from .jobs import Job, JobStatus

    req = CompileRequest.model_validate_json(strmap['metadata'])
    job = Job(
        req=req,
        status=JobStatus(strmap['status']),
        queued_at=strmap['queued_at'],
        started_at=strmap.get('started_at') or None,
        finished_at=strmap.get('finished_at') or None,
        error=strmap.get('error') or None,
    )
    pdf = await _REDIS.get(f'{_PREFIX}{job_id}:pdf')
    if pdf:
        job.pdf_bytes = base64.b64decode(pdf)
    return job


async def update_job_status(job_id: str, status: 'JobStatus', **updates: str | bytes | None) -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    mapping: Dict[str, str] = {'status': status.value}
    for key in ('started_at', 'finished_at', 'error'):
        val = updates.get(key)
        if val is not None:
            mapping[key] = str(val)
    if 'metadata' in updates and updates['metadata'] is not None:
        mapping['metadata'] = str(updates['metadata'])
    _ = await cast(Any, _REDIS.hset(f'{_PREFIX}{job_id}', mapping=mapping))
    pdf_bytes = updates.get('pdf_bytes')
    if pdf_bytes is not None:
        b64 = base64.b64encode(pdf_bytes if isinstance(pdf_bytes, bytes) else pdf_bytes.encode())
        _ = await cast(Any, _REDIS.setex(f'{_PREFIX}{job_id}:pdf', _PDF_TTL, b64))


async def list_jobs() -> Dict[str, 'Job']:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    keys = await _REDIS.keys(f'{_PREFIX}*')
    result: Dict[str, 'Job'] = {}
    for key in keys:
        if key.endswith(b':pdf'):
            continue
        job_id = key.decode().split(':', 1)[1]
        job = await get_job(job_id)
        if job:
            result[job_id] = job
    return result
