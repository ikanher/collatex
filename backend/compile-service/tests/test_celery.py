import asyncio
from pathlib import Path

import fakeredis
import pytest
from httpx import AsyncClient

from compile_service.app.main import app
from httpx import ASGITransport
from collatex.redis_store import init as store_init, get_job, save_job
from collatex.tasks import compile_task
from collatex.models import JobStatus


@pytest.fixture(autouse=True)
def setup():
    client = fakeredis.FakeRedis()
    store_init(client)
    app.state.redis = client
    yield


@pytest.mark.asyncio
async def test_compile_happy_path(monkeypatch):
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
        r = await client.post('/compile', json={'tex': 'hello'})
        assert r.status_code == 202
        job_id = r.headers['Location'].split('/')[-1]
        resp = await client.get(f'/jobs/{job_id}')
        assert resp.json()['status'] == 'SUCCEEDED'
        pdf = await client.get(f'/pdf/{job_id}')
        assert pdf.status_code == 200
        assert pdf.content.startswith(b'%PDF')


@pytest.mark.asyncio
async def test_job_persists_across_process_restart(monkeypatch):
    def instant(job_id: str, tex: str) -> None:
        job = get_job(job_id)
        assert job
        job.status = JobStatus.SUCCEEDED
        job.pdf_path = f'storage/{job_id}.pdf'
        save_job(job)

    monkeypatch.setattr(compile_task, 'delay', instant)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        r = await client.post('/compile', json={'tex': 'x'})
        job_id = r.headers['Location'].split('/')[-1]
    store_init(app.state.redis)
    job = get_job(job_id)
    assert job is not None


@pytest.mark.asyncio
async def test_pdf_endpoint_blocks_until_ready(monkeypatch):
    async def delayed(job_id: str, tex: str) -> None:
        job = get_job(job_id)
        assert job
        await asyncio.sleep(0.1)
        job.status = JobStatus.SUCCEEDED
        pdf = Path('storage') / f'{job_id}.pdf'
        pdf.parent.mkdir(exist_ok=True)
        pdf.write_bytes(b'%PDF-1.4')
        job.pdf_path = str(pdf)
        save_job(job)

    def trigger(job_id: str, tex: str) -> None:
        asyncio.create_task(delayed(job_id, tex))

    monkeypatch.setattr(compile_task, 'delay', trigger)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        r = await client.post('/compile', json={'tex': 'x'})
        job_id = r.headers['Location'].split('/')[-1]
        for _ in range(5):
            pdf = await client.get(f'/pdf/{job_id}')
            if pdf.status_code == 200:
                break
            await asyncio.sleep(0.1)
        assert pdf.status_code == 200
