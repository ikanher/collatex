import importlib
import asyncio

import pytest
import fakeredis.aioredis


@pytest.fixture(params=['memory', 'redis'])
def app(request, monkeypatch):
    state_backend = request.param
    monkeypatch.setenv('COLLATEX_STATE', state_backend)
    if state_backend == 'redis':
        redis_server = fakeredis.aioredis.FakeRedis()
        monkeypatch.setattr('redis.asyncio.Redis.from_url', lambda url: redis_server)
    import compile_service.app.state as state
    importlib.reload(state)
    import compile_service.app.main as main
    importlib.reload(main)
    if state_backend == 'redis':
        state.init(redis_server)
    yield main.app
    if state_backend == 'redis':
        asyncio.run(redis_server.close())

