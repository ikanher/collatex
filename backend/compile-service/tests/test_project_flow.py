import asyncio
import json
from pathlib import Path
import os
import pytest

if os.getenv("COLLATEX_TESTING") == "1":
    pytest.skip("project flow not needed in test mode", allow_module_level=True)

import fakeredis
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
    yield
    asyncio.run(async_client.aclose())


@pytest.mark.asyncio
async def test_project_compile_flow(monkeypatch):
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
        r = await client.post('/projects')
        token = r.json()['token']
        r = await client.post(f'/compile?project={token}', json={'tex': 'x'})
        job_id = r.headers['Location'].split('/')[-1].split('?')[0]
        statuses = []
        async with client.stream('GET', f'/stream/jobs/{job_id}?project={token}') as s:
            async for line in s.aiter_lines():
                if line.startswith('data:'):
                    payload = json.loads(line[5:])
                    statuses.append(payload['status'])
                    if payload['status'] == 'SUCCEEDED':
                        break
        assert statuses[-1] == 'SUCCEEDED'
        pdf = await client.get(f'/pdf/{job_id}?project={token}')
        assert pdf.status_code == 200


@pytest.mark.asyncio
async def test_cross_project_isolation(monkeypatch):
    monkeypatch.setattr(compile_task, 'delay', lambda *a, **k: None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        a = (await client.post('/projects')).json()['token']
        b = (await client.post('/projects')).json()['token']
        r = await client.post(f'/compile?project={a}', json={'tex': 'x'})
        job_id = r.headers['Location'].split('/')[-1].split('?')[0]
        resp = await client.get(f'/jobs/{job_id}?project={b}')
        assert resp.status_code == 404
