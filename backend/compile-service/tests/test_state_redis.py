import asyncio
import importlib

import fakeredis.aioredis
import pytest

from compile_service.app import state
from compile_service.app.jobs import Job, JobStatus
from compile_service.app.models import CompileRequest, FileItem, CompileOptions


@pytest.fixture
def redis_server():
    server = fakeredis.aioredis.FakeRedis()
    yield server
    asyncio.run(server.close())


@pytest.fixture(autouse=True)
def setup_state(monkeypatch, redis_server):
    monkeypatch.setenv('COLLATEX_STATE', 'redis')
    importlib.reload(state)
    state.init(redis_server)


def _job() -> Job:
    req = CompileRequest(
        projectId='x',
        entryFile='main.tex',
        files=[FileItem(path='main.tex', contentBase64='YQ==')],
        options=CompileOptions(),
    )
    return Job(req=req)


def test_round_trip(redis_server):
    job = _job()
    asyncio.run(state.add_job('1', job))
    other = asyncio.run(state.get_job('1'))
    assert other == job


def test_update_visible_across_instances(redis_server):
    job = _job()
    asyncio.run(state.add_job('2', job))
    asyncio.run(state.update_job_status('2', JobStatus.DONE, finished_at='now'))

    importlib.reload(state)
    state.init(redis_server)

    again = asyncio.run(state.get_job('2'))
    assert again.finished_at == 'now'
    assert again.status == JobStatus.DONE

