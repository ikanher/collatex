# ruff: noqa
import asyncio
import json
from pathlib import Path
import sys
from pathlib import Path as _P
import pytest
pytest.skip('legacy', allow_module_level=True)
sys.path.insert(0, str(_P(__file__).resolve().parents[1] / 'src'))

import fakeredis
import pytest
from httpx import AsyncClient, ASGITransport

from compile_service.app.main import app
from collatex.redis_store import init as store_init, get_job, save_job, publish_status
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
async def test_sse_success(monkeypatch):
    def instant(job_id: str, tex: str) -> None:
        job = get_job(job_id)
        assert job
        job.status = JobStatus.RUNNING
        save_job(job)
        publish_status(job)
        job.status = JobStatus.SUCCEEDED
        pdf = Path('storage') / f'{job_id}.pdf'
        pdf.parent.mkdir(exist_ok=True)
        pdf.write_bytes(b'%PDF-1.4')
        job.pdf_path = str(pdf)
        save_job(job)
        publish_status(job)

    monkeypatch.setattr(compile_task, 'delay', instant)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        r = await client.post('/compile', json={'tex': 'hi'})
        job_id = r.headers['Location'].split('/')[-1]
        statuses = []
        async with client.stream('GET', f'/stream/jobs/{job_id}') as stream:
            async for line in stream.aiter_lines():
                if line.startswith('data:'):
                    payload = json.loads(line[5:])
                    statuses.append(payload['status'])
                    if payload['status'] == 'SUCCEEDED':
                        break
        assert statuses == ['RUNNING', 'SUCCEEDED']
        metrics = (await client.get('/metrics')).text
        assert 'compile_total{status="succeeded"} 1.0' in metrics
