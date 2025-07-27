from __future__ import annotations

import json
from typing import Any, Dict

import redis.asyncio as redis
from typing import cast

_REDIS: redis.Redis | None = None
_QUEUE_KEY = 'compile:queue'


def init(client: redis.Redis) -> None:
    global _REDIS
    _REDIS = client


async def enqueue_job(job_id: str, request_json: str) -> None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    payload = json.dumps({'job_id': job_id, 'request_json': request_json})
    await cast(Any, _REDIS.rpush(_QUEUE_KEY, payload))


async def dequeue_job() -> Dict[str, Any] | None:
    if _REDIS is None:
        raise RuntimeError('redis not initialized')
    item = await cast(Any, _REDIS.blpop([_QUEUE_KEY], timeout=5))
    if not item:
        return None
    _, data = item
    return cast(Dict[str, Any], json.loads(data.decode()))
