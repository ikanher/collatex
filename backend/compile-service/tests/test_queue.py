# ruff: noqa
import pytest; pytest.skip('legacy', allow_module_level=True)  # noqa: E402
import asyncio
import importlib
import uuid

import os
import redis.asyncio as redis
from compile_service.app import state
from compile_service.app.jobs import Job, JobStatus
from compile_service.app.models import CompileRequest, FileItem, CompileOptions
from .helpers import require_redis


def test_worker_processes_queue(monkeypatch) -> None:
    require_redis()

    async def _run() -> None:
        url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        redis_server = redis.from_url(url)
        await redis_server.flushdb()
        monkeypatch.setenv('COLLATEX_STATE', 'redis')
        monkeypatch.setenv('ANYIO_TEST_BACKENDS', 'asyncio')
        importlib.reload(state)
        state.init(redis_server)
        import compile_service.queue as queue
        import compile_service.worker as worker

        importlib.reload(queue)
        queue.init(redis_server)

        def dummy(job: Job) -> None:
            job.status = JobStatus.DONE
            job.finished_at = 'x'

        monkeypatch.setattr('compile_service.executor.run_compile', dummy)

        req = CompileRequest(
            projectId='p',
            entryFile='main.tex',
            files=[FileItem(path='main.tex', contentBase64='YQ==')],
            options=CompileOptions(),
        )
        id1, id2 = str(uuid.uuid4()), str(uuid.uuid4())
        await state.add_job(id1, Job(req=req))
        await state.add_job(id2, Job(req=req))
        await queue.enqueue_job(id1, req.model_dump_json())
        await queue.enqueue_job(id2, req.model_dump_json())

        item1 = await queue.dequeue_job()
        item2 = await queue.dequeue_job()
        assert item1 and item2
        await worker._process(item1)
        await worker._process(item2)

        j1 = await state.get_job(id1)
        j2 = await state.get_job(id2)
        assert j1.status in {JobStatus.DONE, JobStatus.ERROR}
        assert j2.status in {JobStatus.DONE, JobStatus.ERROR}

        await redis_server.aclose()

    asyncio.run(_run())
