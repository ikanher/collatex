from __future__ import annotations

import base64
from typing import Any, Dict
import os
import redis.asyncio as redis

from prometheus_client import make_asgi_app

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import max_upload_bytes
from .jobs import JobStatus, enqueue
from .state import get_job, init as state_init
from ..logging import configure_logging
from .middleware import RequestIdMiddleware
from .models import CompileRequest, CompileResponse
from .. import queue
from .worker import start_worker, stop_worker
from .security import contains_forbidden_tex

MAX_UPLOAD_BYTES = max_upload_bytes()

configure_logging()

app = FastAPI(title='CollaTeX Compile Service', version='0.1.0')
app.mount('/metrics', make_asgi_app(), name='metrics')


@app.on_event('startup')
async def setup_redis() -> None:
    if os.getenv('COLLATEX_STATE', 'memory') == 'redis':
        url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        client = redis.from_url(url)  # type: ignore[no-untyped-call]
        await client.ping()
        state_init(client)
        queue.init(client)
        app.state.redis = client


@app.on_event('startup')
def launch_worker() -> None:
    if os.getenv('COLLATEX_STATE', 'memory') != 'redis':
        start_worker()
        app.state.worker_stop = stop_worker


@app.on_event('shutdown')
async def close_redis() -> None:
    client = getattr(app.state, 'redis', None)
    if client is not None:
        await client.close()
    stop = getattr(app.state, 'worker_stop', None)
    if stop is not None:
        stop()


app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.add_middleware(RequestIdMiddleware)


@app.get('/healthz')
async def healthz() -> Dict[str, str]:
    return {'status': 'ok'}


async def _parse_compile_request(request: Request) -> CompileRequest:
    length = request.headers.get('content-length')
    if length and int(length) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='payload too large')
    body = await request.body()
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='payload too large')
    try:
        return CompileRequest.model_validate_json(body)
    except Exception as exc:
        if hasattr(exc, 'errors'):
            detail = jsonable_encoder(exc.errors())
        else:
            detail = 'validation error'
        raise HTTPException(status_code=400, detail=detail) from exc


@app.post('/compile', response_model=CompileResponse, status_code=202)
async def compile_endpoint(
    req: CompileRequest = Depends(_parse_compile_request),
) -> CompileResponse:
    _validate_request(req)
    job_id = await enqueue(req)
    return CompileResponse(jobId=job_id)


@app.get('/jobs/{job_id}')
async def job_status(job_id: str) -> JSONResponse:
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    body: Dict[str, Any] = {
        'jobId': job_id,
        'status': job.status.value,
        'queuedAt': job.queued_at,
        'startedAt': job.started_at,
        'finishedAt': job.finished_at,
        'error': job.error,
    }
    if job.logs:
        body['logs'] = job.logs
    if job.pdf_bytes:
        body['pdfUrl'] = f'/pdf/{job_id}'
    return JSONResponse(content=body)


@app.get('/pdf/{job_id}')
async def get_pdf(job_id: str) -> Response:
    job = await get_job(job_id)
    if not job or job.status != JobStatus.DONE or not job.pdf_bytes:
        raise HTTPException(status_code=404, detail='pdf not found')
    return Response(
        content=job.pdf_bytes,
        media_type='application/pdf',
        headers={'Cache-Control': 'no-store'},
    )


def _validate_request(req: CompileRequest) -> None:
    seen = set()
    total_bytes = 0
    for f in req.files:
        if f.path in seen:
            raise HTTPException(status_code=400, detail=f'duplicate path: {f.path}')
        seen.add(f.path)
        try:
            raw = base64.b64decode(f.contentBase64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f'invalid base64 for {f.path}') from exc
        if contains_forbidden_tex(raw):
            raise HTTPException(status_code=422, detail='shell escape disallowed')
        total_bytes += len(raw)

    if total_bytes > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='payload too large')
