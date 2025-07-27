import asyncio
import importlib

import fakeredis.aioredis
import pytest
from fastapi.testclient import TestClient

from .test_validation import minimal_payload


@pytest.fixture
def limiter_app(monkeypatch):
    monkeypatch.setenv('COLLATEX_STATE', 'redis')
    monkeypatch.setenv('COLLATEX_RATE_LIMIT', '20')
    fake = fakeredis.aioredis.FakeRedis()
    monkeypatch.setattr('redis.asyncio.Redis.from_url', lambda url='redis://localhost:6379/0': fake)
    import compile_service.app.state as state
    import compile_service.app.main as main

    importlib.reload(state)
    importlib.reload(main)
    state.init(fake)
    yield main.app
    asyncio.run(fake.aclose())
    stop = getattr(main.app.state, 'worker_stop', None)
    if stop is not None:
        stop()


def test_rate_limit(limiter_app):
    payload = minimal_payload()
    with TestClient(limiter_app) as client:
        headers1 = {'Authorization': 'Bearer t1'}
        for _ in range(20):
            resp = client.post('/compile', json=payload, headers=headers1)
            assert resp.status_code == 202
        headers2 = {'Authorization': 'Bearer t2'}
        resp = client.post('/compile', json=payload, headers=headers2)
        assert resp.status_code == 202
        resp = client.post('/compile', json=payload, headers=headers1)
        assert resp.status_code == 429
        assert resp.json()['detail'] == 'rate limit exceeded'
        metrics = client.get('/metrics').text
        assert 'collatex_compile_total{status="rate_limited"} 1' in metrics
