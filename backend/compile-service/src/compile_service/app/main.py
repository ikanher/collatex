from __future__ import annotations

import os
import uuid
from datetime import datetime
import secrets
import time
from pathlib import Path
from contextlib import asynccontextmanager

import json
import redis
import redis.asyncio as aioredis
from typing import AsyncGenerator, Optional, Dict, Any, cast
from prometheus_client import make_asgi_app
from fastapi import FastAPI, HTTPException, Depends, Query, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from structlog import get_logger

from ..logging import configure_logging, job_id_var

from collatex.models import Job, JobStatus, Project
from collatex.redis_store import (
    init as store_init,
    get_job,
    save_job,
    create_project,
    get_project,
    STATUS_CHANNEL,
    publish_status,
)
from collatex.tasks import compile_task
from collatex.settings import TESTING, REDIS_URL


configure_logging()
logger = get_logger(__name__)


def compile_tex_sync(tex_source: str, pdf_path: Path) -> None:
    pdf_path.write_bytes(b'%PDF-1.4\n% dummy PDF for tests\n')

FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://localhost:5173')

_mem: Dict[str, Dict[str, str]] = {}
r: Optional[aioredis.Redis] = None


def PK(t: str) -> str:
    return f'collatex:project:{t}'


async def get_meta(token: str) -> Optional[Dict[str, str]]:
    if r:
        meta = await cast(Any, r).hgetall(PK(token))
        if not meta:
            return None
        return {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in meta.items()}
    return _mem.get(token)


async def set_meta(token: str, **fields: str) -> None:
    if r:
        await cast(Any, r).hset(PK(token), mapping=fields)
    else:
        _mem.setdefault(token, {}).update(fields)


def now_ms() -> int:
    return int(time.time() * 1000)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    url = REDIS_URL
    client = redis.from_url(url)  # type: ignore[no-untyped-call]
    store_init(client)
    app.state.redis = client
    app.state.redis_async = aioredis.from_url(url)  # type: ignore[no-untyped-call]
    global r
    r = app.state.redis_async
    try:
        yield
    finally:
        client.close()
        await app.state.redis_async.aclose()


app = FastAPI(title='CollaTeX Compile Service', version='0.1.0', lifespan=lifespan)
app.mount('/metrics', make_asgi_app())


allowed_origins = os.getenv('COLLATEX_ALLOWED_ORIGINS')
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins.split(','),
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$',
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )


class CompileRequest(BaseModel):
    tex: str


def require_project(request: Request, project: str | None = Query(None)) -> Project:
    if request.method == 'OPTIONS':
        return Project(token='', created_at=datetime.utcnow())
    if project is None:
        raise HTTPException(status_code=404, detail='project not found')
    proj = get_project(project)
    if proj is None:
        raise HTTPException(status_code=404, detail='project not found')
    return proj




@app.get('/healthz')
def healthz() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/projects', status_code=201)
async def create_project_endpoint() -> JSONResponse:
    token = secrets.token_urlsafe(9)[:12]
    owner_key = secrets.token_urlsafe(24)
    project = Project(token=token, created_at=datetime.utcnow())
    await run_in_threadpool(create_project, project)
    await set_meta(token, ownerKey=owner_key, locked='0', lastActivityAt=str(now_ms()))
    headers = {'Location': f'{FRONTEND_ORIGIN}/p/{token}'}
    return JSONResponse({'token': token, 'ownerKey': owner_key}, status_code=201, headers=headers)


@app.get('/projects/{token}')
async def get_project_endpoint(token: str) -> dict[str, object]:
    meta = await get_meta(token)
    if not meta:
        raise HTTPException(404, 'not_found')
    return {
        'token': token,
        'locked': meta.get('locked') == '1',
        'lastActivityAt': int(meta.get('lastActivityAt', '0') or '0'),
    }


@app.post('/projects/{token}/lock')
async def lock_project(token: str, payload: Dict[str, str] = Body(...)) -> dict[str, bool]:
    meta = await get_meta(token)
    if not meta:
        raise HTTPException(404, 'not_found')
    if payload.get('ownerKey') != meta.get('ownerKey'):
        raise HTTPException(403, 'forbidden')
    await set_meta(token, locked='1')
    return {'ok': True}


@app.post('/projects/{token}/unlock')
async def unlock_project(token: str, payload: Dict[str, str] = Body(...)) -> dict[str, bool]:
    meta = await get_meta(token)
    if not meta:
        raise HTTPException(404, 'not_found')
    if payload.get('ownerKey') != meta.get('ownerKey'):
        raise HTTPException(403, 'forbidden')
    await set_meta(token, locked='0')
    return {'ok': True}


@app.post('/projects/{token}/touch')
async def touch_project(token: str) -> dict[str, bool]:
    meta = await get_meta(token)
    if not meta:
        raise HTTPException(404, 'not_found')
    await set_meta(token, lastActivityAt=str(now_ms()))
    return {'ok': True}



@app.post('/compile', status_code=202)
async def compile_endpoint(
    req: CompileRequest, project: Project = Depends(require_project)
) -> JSONResponse:
    job_id = str(uuid.uuid4())
    ctx = job_id_var.set(job_id)
    logger.debug('compile_request', project=project.token)
    job = Job(id=job_id, project_token=project.token, created_at=datetime.utcnow())
    await run_in_threadpool(save_job, job)
    storage = Path('storage')
    storage.mkdir(exist_ok=True)
    pdf_path = storage / f'{job_id}.pdf'
    if TESTING:
        logger.debug('compile_testing_mode')
        compile_tex_sync(req.tex, pdf_path)
        job.status = JobStatus.SUCCEEDED
        job.pdf_path = str(pdf_path)
        await run_in_threadpool(save_job, job)
        await run_in_threadpool(publish_status, job)
    else:
        logger.debug('compile_enqueued')
        compile_task.delay(job_id, req.tex)
    job_id_var.reset(ctx)
    return JSONResponse(
        {'jobId': job_id},
        status_code=202,
        headers={'Location': f'/jobs/{job_id}?project={project.token}'},
    )


@app.get('/jobs/{job_id}')
async def job_status(job_id: str, project: Project = Depends(require_project)) -> JSONResponse:
    ctx = job_id_var.set(job_id)
    logger.debug('job_status_request')
    job = await run_in_threadpool(get_job, job_id)
    if not job:
        logger.debug('job_status_not_found')
        job_id_var.reset(ctx)
        raise HTTPException(status_code=404, detail='job not found')
    if job.project_token != project.token:
        logger.debug('job_status_project_mismatch')
        job_id_var.reset(ctx)
        raise HTTPException(status_code=404, detail='job not found')
    body = {
        'jobId': job.id,
        'status': job.status.value,
        'log': job.log,
    }
    if job.status == JobStatus.SUCCEEDED and job.pdf_path:
        body['pdfUrl'] = f'/pdf/{job.id}?project={project.token}'
    logger.debug('job_status_response', status=job.status.value)
    job_id_var.reset(ctx)
    return JSONResponse(content=body)


@app.get('/stream/jobs/{job_id}')
async def stream_job(job_id: str, project: Project = Depends(require_project)) -> Response:
    ctx_outer = job_id_var.set(job_id)
    logger.debug('stream_job_request')
    job = await run_in_threadpool(get_job, job_id)
    if not job or job.project_token != project.token:
        logger.debug('stream_job_not_found')
        job_id_var.reset(ctx_outer)
        raise HTTPException(status_code=404, detail='job not found')
    job_id_var.reset(ctx_outer)

    redis_async = app.state.redis_async
    pubsub = redis_async.pubsub()
    await pubsub.subscribe(STATUS_CHANNEL)

    async def event_gen() -> AsyncGenerator[str, None]:
        ctx = job_id_var.set(job_id)
        try:
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
                if msg is None:
                    yield ': ping\n\n'
                    continue
                data = json.loads(msg['data'])
                if data.get('id') != job_id:
                    continue
                logger.debug('stream_job_event', status=data.get('status'))
                yield f'data: {json.dumps(data)}\n\n'
                if data.get('status') in {'SUCCEEDED', 'FAILED'}:
                    break
        finally:
            await pubsub.unsubscribe(STATUS_CHANNEL)
            await pubsub.close()
            logger.debug('stream_job_close')
            job_id_var.reset(ctx)

    return StreamingResponse(event_gen(), media_type='text/event-stream')


@app.get('/pdf/{job_id}')
async def get_pdf(job_id: str, project: Project = Depends(require_project)) -> FileResponse:
    ctx = job_id_var.set(job_id)
    logger.debug('pdf_request')
    job = await run_in_threadpool(get_job, job_id)
    if not job or job.project_token != project.token:
        logger.debug('pdf_not_found')
        job_id_var.reset(ctx)
        raise HTTPException(status_code=404, detail='pdf not found')
    if job.status != JobStatus.SUCCEEDED or not job.pdf_path:
        logger.debug('pdf_not_ready', status=job.status.value)
        job_id_var.reset(ctx)
        raise HTTPException(status_code=404, detail='pdf not found')
    logger.debug('pdf_response', path=job.pdf_path)
    job_id_var.reset(ctx)
    return FileResponse(job.pdf_path, media_type='application/pdf')
