import asyncio
import json
from pathlib import Path

import fakeredis
import pytest
from httpx import AsyncClient, ASGITransport

from compile_service.app.main import app
from collatex.redis_store import init as store_init, get_job, save_job
from collatex.tasks import compile_task
from collatex.models import JobStatus


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    sync_client = fakeredis.FakeRedis()
    async_client = fakeredis.aioredis.FakeRedis()
    monkeypatch.setattr('redis.from_url', lambda url, *a, **k: sync_client)
    monkeypatch.setattr('redis.asyncio.from_url', lambda url, *a, **k: async_client)
    store_init(sync_client)
    app.state.redis = sync_client
    app.state.redis_async = async_client
    from argon2 import PasswordHasher
    app.state.ph = PasswordHasher()
    yield
    asyncio.run(async_client.aclose())


@pytest.mark.asyncio
async def test_signup_login_compile_stream(monkeypatch):
    def instant(job_id: str, tex: str) -> None:
        job = get_job(job_id)
        assert job
        job.status = JobStatus.SUCCEEDED
        pdf = Path('storage') / f'{job_id}.pdf'
        pdf.parent.mkdir(exist_ok=True)
        pdf.write_bytes(b'%PDF-1.4')
        job.pdf_path = str(pdf)
        save_job(job)

    monkeypatch.setattr(compile_task, 'delay', instant)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        r = await client.post('/signup', json={'email': 'a@example.com', 'password': 'pw'})
        assert r.status_code == 201
        r = await client.post('/login', json={'email': 'a@example.com', 'password': 'pw'})
        token = r.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        r = await client.post('/compile', json={'tex': 'x'}, headers=headers)
        job_id = r.headers['Location'].split('/')[-1]
        statuses = []
        async with client.stream('GET', f'/stream/jobs/{job_id}', headers=headers) as s:
            async for line in s.aiter_lines():
                if line.startswith('data:'):
                    payload = json.loads(line[5:])
                    statuses.append(payload['status'])
                    if payload['status'] == 'SUCCEEDED':
                        break
        assert statuses[-1] == 'SUCCEEDED'
        pdf = await client.get(f'/pdf/{job_id}', headers=headers)
        assert pdf.status_code == 200


@pytest.mark.asyncio
async def test_cross_tenant_isolation(monkeypatch):
    monkeypatch.setattr(compile_task, 'delay', lambda *a, **k: None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        await client.post('/signup', json={'email': 'a@example.com', 'password': 'pw'})
        await client.post('/signup', json={'email': 'b@example.com', 'password': 'pw'})
        ta = (await client.post('/login', json={'email': 'a@example.com', 'password': 'pw'})).json()['access_token']
        tb = (await client.post('/login', json={'email': 'b@example.com', 'password': 'pw'})).json()['access_token']
        r = await client.post('/compile', json={'tex': 'x'}, headers={'Authorization': f'Bearer {ta}'})
        job_id = r.headers['Location'].split('/')[-1]
        resp = await client.get(f'/jobs/{job_id}', headers={'Authorization': f'Bearer {tb}'})
        assert resp.status_code == 404
