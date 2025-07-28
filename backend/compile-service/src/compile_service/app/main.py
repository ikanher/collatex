from __future__ import annotations

import os
import uuid
from datetime import datetime

import redis
import redis.asyncio as aioredis
import json
from typing import AsyncGenerator
from prometheus_client import make_asgi_app
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from collatex.models import Job, JobStatus
from collatex.redis_store import (
    init as store_init,
    get_job,
    save_job,
    STATUS_CHANNEL,
)
from collatex.tasks import compile_task
from collatex.auth import create_access_token
from compile_service.auth import get_current_user
from argon2 import PasswordHasher

app = FastAPI(title='CollaTeX Compile Service', version='0.1.0')
app.mount('/metrics', make_asgi_app())


@app.on_event('startup')
def setup() -> None:
    url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    client = redis.from_url(url)  # type: ignore[no-untyped-call]
    store_init(client)
    app.state.redis = client
    app.state.redis_async = aioredis.from_url(url)  # type: ignore[no-untyped-call]
    app.state.ph = PasswordHasher()
    demo_email = os.getenv('COLLATEX_DEMO_EMAIL')
    demo_pw = os.getenv('COLLATEX_DEMO_PASSWORD')
    if demo_email and demo_pw and not client.hget('collatex:users', demo_email):
        client.hset('collatex:users', demo_email, app.state.ph.hash(demo_pw))


@app.on_event('shutdown')
def cleanup() -> None:
    client = getattr(app.state, 'redis', None)
    if client is not None:
        client.close()
    client_async = getattr(app.state, 'redis_async', None)
    if client_async is not None:
        import asyncio
        asyncio.run(client_async.aclose())


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


class UserCreds(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str


@app.get('/healthz')
def healthz() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/signup', status_code=201)
async def signup(creds: UserCreds, request: Request) -> Response:
    client = request.app.state.redis
    ph: PasswordHasher = request.app.state.ph
    if client.hget('collatex:users', creds.email):
        raise HTTPException(status_code=400, detail='exists')
    hashed = await run_in_threadpool(ph.hash, creds.password)
    await run_in_threadpool(client.hset, 'collatex:users', creds.email, hashed)
    return Response(status_code=201)


@app.post('/login', response_model=TokenResponse)
async def login(creds: UserCreds, request: Request) -> TokenResponse:
    client = request.app.state.redis
    ph: PasswordHasher = request.app.state.ph
    stored = await run_in_threadpool(client.hget, 'collatex:users', creds.email)
    if not stored:
        raise HTTPException(status_code=401, detail='invalid credentials')
    try:
        await run_in_threadpool(ph.verify, stored.decode(), creds.password)
    except Exception as exc:  # pragma: no cover - wrong password
        raise HTTPException(status_code=401, detail='invalid credentials') from exc
    token = create_access_token(creds.email)
    return TokenResponse(access_token=token)

@app.post('/compile', status_code=202)
async def compile_endpoint(req: CompileRequest, user_id: str = Depends(get_current_user)) -> Response:
    job_id = f'{user_id}:{uuid.uuid4()}'
    job = Job(id=job_id, owner=user_id, created_at=datetime.utcnow())
    await run_in_threadpool(save_job, job)
    compile_task.delay(job_id, req.tex)
    return Response(status_code=202, headers={'Location': f'/jobs/{job_id}'})


@app.get('/jobs/{job_id}')
async def job_status(job_id: str, user_id: str = Depends(get_current_user)) -> JSONResponse:
    if not job_id.startswith(f'{user_id}:'):
        raise HTTPException(status_code=404, detail='job not found')
    job = await run_in_threadpool(get_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    body = {
        'jobId': job.id,
        'status': job.status.value,
        'log': job.log,
    }
    if job.status == JobStatus.SUCCEEDED and job.pdf_path:
        body['pdfUrl'] = f'/pdf/{job.id}'
    return JSONResponse(content=body)


@app.get('/stream/jobs/{job_id}')
async def stream_job(job_id: str, user_id: str = Depends(get_current_user)) -> Response:
    if not job_id.startswith(f'{user_id}:'):
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
async def get_pdf(job_id: str, user_id: str = Depends(get_current_user)) -> FileResponse:
    if not job_id.startswith(f'{user_id}:'):
        raise HTTPException(status_code=404, detail='pdf not found')
    job = await run_in_threadpool(get_job, job_id)
    if not job or job.status != JobStatus.SUCCEEDED or not job.pdf_path:
        raise HTTPException(status_code=404, detail='pdf not found')
    return FileResponse(job.pdf_path, media_type='application/pdf')
