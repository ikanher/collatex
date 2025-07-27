from __future__ import annotations

import os
from datetime import datetime, timedelta

from fastapi import HTTPException, Request
import redis.asyncio as redis

from ..executor import COMPILE_COUNTER

_DEFAULT_LIMIT = int(os.getenv('COLLATEX_RATE_LIMIT', '20'))


async def rate_limit(request: Request) -> None:
    token = getattr(request.state, 'token', None)
    if not token:
        return
    client: redis.Redis | None = getattr(request.app.state, 'redis', None)
    if client is None:
        return
    now = datetime.utcnow()
    minute = now.strftime('%Y%m%d%H%M')
    key = f'rl:{token}:{minute}'
    pipe = client.pipeline()
    pipe.incr(key)
    pipe.expire(key, 3600)
    await pipe.execute()

    keys = [f'rl:{token}:{(now - timedelta(minutes=i)).strftime("%Y%m%d%H%M")}' for i in range(60)]
    counts = await client.mget(keys)
    total = sum(int(c) for c in counts if c)
    limit = int(os.getenv('COLLATEX_RATE_LIMIT', str(_DEFAULT_LIMIT)))
    if total > limit:
        COMPILE_COUNTER.labels(status='rate_limited').inc()
        raise HTTPException(status_code=429, detail='rate limit exceeded')
