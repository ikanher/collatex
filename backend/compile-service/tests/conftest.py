import importlib
import asyncio

import pytest
import os
import redis.asyncio as redis
from .helpers import require_redis


@pytest.fixture(params=['memory', 'redis'])
def app(request, monkeypatch):
    state_backend = request.param
    monkeypatch.setenv('COLLATEX_STATE', state_backend)
    if state_backend == 'redis':
        require_redis()
        url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        redis_server = redis.from_url(url)
        monkeypatch.setattr('redis.asyncio.Redis.from_url', lambda url=url: redis_server)
    import compile_service.app.state as state

    importlib.reload(state)
    import compile_service.app.main as main

    importlib.reload(main)
    if state_backend == 'redis':
        state.init(redis_server)
    yield main.app
    if state_backend == 'redis':
        asyncio.run(redis_server.aclose())
    stop = getattr(main.app.state, 'worker_stop', None)
    if stop is not None:
        stop()
