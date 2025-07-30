from __future__ import annotations

import os
import uuid
from datetime import datetime
import secrets
from pathlib import Path
from contextlib import asynccontextmanager

import json
import redis
import redis.asyncio as aioredis
from typing import AsyncGenerator
from prometheus_client import make_asgi_app
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

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


def compile_tex_sync(tex_source: str, pdf_path: Path) -> None:
    pdf_path.write_bytes(b'%PDF-1.4\n% dummy PDF for tests\n')

FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'http://localhost:5173')


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    url = REDIS_URL
    client = redis.from_url(url)  # type: ignore[no-untyped-call]
    store_init(client)
    app.state.redis = client
    app.state.redis_async = aioredis.from_url(url)  # type: ignore[no-untyped-call]
    try:
        yield
    finally:
        client.close()
        await app.state.redis_async.aclose()


app = FastAPI(title='CollaTeX Compile Service', version='0.1.0', lifespan=lifespan)
app.mount('/metrics', make_asgi_app())


origins = os.getenv('COLLATEX_ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class CompileRequest(BaseModel):
    tex: str


def require_project(project: str = Query(...)) -> Project:
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
    project = Project(token=token, created_at=datetime.utcnow())
    await run_in_threadpool(create_project, project)
    headers = {'Location': f'{FRONTEND_ORIGIN}/p/{token}'}
    return JSONResponse({'token': token}, status_code=201, headers=headers)



@app.post('/compile', status_code=202)
async def compile_endpoint(
    req: CompileRequest, project: Project = Depends(require_project)
) -> Response:
    job_id = str(uuid.uuid4())
    job = Job(id=job_id, project_token=project.token, created_at=datetime.utcnow())
    await run_in_threadpool(save_job, job)
    storage = Path('storage')
    storage.mkdir(exist_ok=True)
    pdf_path = storage / f'{job_id}.pdf'
    if TESTING:
        compile_tex_sync(req.tex, pdf_path)
        job.status = JobStatus.SUCCEEDED
        job.pdf_path = str(pdf_path)
        await run_in_threadpool(save_job, job)
        await run_in_threadpool(publish_status, job)
    else:
        compile_task.delay(job_id, req.tex)
    return Response(status_code=202, headers={'Location': f'/jobs/{job_id}?project={project.token}'})


@app.get('/jobs/{job_id}')
async def job_status(job_id: str, project: Project = Depends(require_project)) -> JSONResponse:
    job = await run_in_threadpool(get_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    if job.project_token != project.token:
        raise HTTPException(status_code=404, detail='job not found')
    body = {
        'jobId': job.id,
        'status': job.status.value,
        'log': job.log,
    }
    if job.status == JobStatus.SUCCEEDED and job.pdf_path:
        body['pdfUrl'] = f'/pdf/{job.id}?project={project.token}'
    return JSONResponse(content=body)


@app.get('/stream/jobs/{job_id}')
async def stream_job(job_id: str, project: Project = Depends(require_project)) -> Response:
    job = await run_in_threadpool(get_job, job_id)
    if not job or job.project_token != project.token:
        raise HTTPException(status_code=404, detail='job not found')
    redis_async = app.state.redis_async
    pubsub = redis_async.pubsub()
    await pubsub.subscribe(STATUS_CHANNEL)

    async def event_gen() -> AsyncGenerator[str, None]:
        try:
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
                if msg is None:
                    yield ': ping\n\n'
                    continue
                data = json.loads(msg['data'])
                if data.get('id') != job_id:
                    continue
                yield f'data: {json.dumps(data)}\n\n'
                if data.get('status') in {'SUCCEEDED', 'FAILED'}:
                    break
        finally:
            await pubsub.unsubscribe(STATUS_CHANNEL)
            await pubsub.close()

    return StreamingResponse(event_gen(), media_type='text/event-stream')


@app.get('/pdf/{job_id}')
async def get_pdf(job_id: str, project: Project = Depends(require_project)) -> FileResponse:
    job = await run_in_threadpool(get_job, job_id)
    if not job or job.project_token != project.token:
        raise HTTPException(status_code=404, detail='pdf not found')
    if job.status != JobStatus.SUCCEEDED or not job.pdf_path:
        raise HTTPException(status_code=404, detail='pdf not found')
    return FileResponse(job.pdf_path, media_type='application/pdf')
