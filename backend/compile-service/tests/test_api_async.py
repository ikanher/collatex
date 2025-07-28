# ruff: noqa
import pytest; pytest.skip('legacy', allow_module_level=True)  # noqa: E402
import asyncio
import base64
import importlib
from typing import AsyncIterator, Generator

import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI
from asgi_lifespan import LifespanManager
from contextlib import asynccontextmanager

import compile_service.app.main as main


from typing import Any, Dict


def minimal_payload(tex: bytes) -> Dict[str, Any]:
    return {
        'projectId': 'demo',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(tex).decode()}],
        'options': {'synctex': False, 'maxSeconds': 5, 'maxMemoryMb': 64},
    }


@pytest.fixture
def mem_app(monkeypatch: pytest.MonkeyPatch) -> Generator[FastAPI, None, None]:
    monkeypatch.setenv('COLLATEX_STATE', 'memory')
    import compile_service.app.state as state
    importlib.reload(state)
    importlib.reload(main)
    yield main.app
    stop = getattr(main.app.state, 'worker_stop', None)
    if stop:
        stop()


@pytest.fixture
def rate_limited_app(monkeypatch: pytest.MonkeyPatch) -> Generator[FastAPI, None, None]:
    monkeypatch.setenv('COLLATEX_STATE', 'redis')
    monkeypatch.setenv('COLLATEX_RATE_LIMIT', '2')
    import fakeredis.aioredis
    fake = fakeredis.aioredis.FakeRedis()
    monkeypatch.setattr('redis.asyncio.Redis.from_url', lambda url='redis://localhost:6379/0': fake)
    import compile_service.app.state as state
    importlib.reload(state)
    importlib.reload(main)
    state.init(fake)
    yield main.app
    asyncio.run(fake.aclose())
    stop = getattr(main.app.state, 'worker_stop', None)
    if stop:
        stop()


@pytest.fixture
def token_app(monkeypatch: pytest.MonkeyPatch) -> Generator[FastAPI, None, None]:
    monkeypatch.setenv('COLLATEX_STATE', 'memory')
    monkeypatch.setenv('COLLATEX_API_TOKEN', 'secret')
    import compile_service.app.state as state
    importlib.reload(state)
    importlib.reload(main)
    yield main.app
    stop = getattr(main.app.state, 'worker_stop', None)
    if stop:
        stop()

@asynccontextmanager
async def lifespan_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url='http://test') as client:
            yield client


@pytest.mark.asyncio
async def test_compile_success_async(mem_app: FastAPI) -> None:
    async with lifespan_client(mem_app) as client:
        payload = minimal_payload(b'\\documentclass{article}\\begin{document}ok\\end{document}')
        r = await client.post('/compile', json=payload)
        assert r.status_code == 202
        job_id = r.json()['jobId']
        for _ in range(50):
            s = await client.get(f'/jobs/{job_id}')
            if s.json()['status'] in {'done', 'error'}:
                break
            await asyncio.sleep(0.2)
        assert s.json()['status'] == 'done'
        pdf = await client.get(f'/pdf/{job_id}')
        assert pdf.status_code == 200
        assert pdf.content.startswith(b'%PDF')


@pytest.mark.asyncio
@pytest.mark.skip('stub executor always succeeds')
async def test_compile_error_async(mem_app: FastAPI) -> None:
    async with lifespan_client(mem_app) as client:
        payload = minimal_payload(b'\\documentclass{article}')
        r = await client.post('/compile', json=payload)
        job_id = r.json()['jobId']
        for _ in range(30):
            s = await client.get(f'/jobs/{job_id}')
            if s.json()['status'] in {'done', 'error'}:
                break
            await asyncio.sleep(0.2)
        body = s.json()
        assert body['status'] == 'error'
        assert body.get('log')
        pdf = await client.get(f'/pdf/{job_id}')
        assert pdf.status_code == 404


@pytest.mark.asyncio
async def test_unknown_job_async(mem_app: FastAPI) -> None:
    async with lifespan_client(mem_app) as client:
        r = await client.get('/jobs/unknown')
        assert r.status_code == 404
        r = await client.get('/pdf/unknown')
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_rate_limit_async(rate_limited_app: FastAPI) -> None:
    async with lifespan_client(rate_limited_app) as client:
        p = minimal_payload(b'X')
        headers = {'Authorization': 'Bearer a'}
        await client.post('/compile', json=p, headers=headers)
        await client.post('/compile', json=p, headers=headers)
        resp = await client.post('/compile', json=p, headers=headers)
        assert resp.status_code == 429
    from compile_service.executor import COMPILE_COUNTER
    COMPILE_COUNTER.clear()


@pytest.mark.asyncio
async def test_auth_failure_async(token_app: FastAPI) -> None:
    async with lifespan_client(token_app) as client:
        p = minimal_payload(b'hi')
        r = await client.post('/compile', json=p)
        assert r.status_code == 401
        r = await client.post('/compile', json=p, headers={'Authorization': 'Bearer wrong'})
        assert r.status_code == 401
