from __future__ import annotations

import base64
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from .config import max_upload_bytes
from .jobs import JOBS, JobStatus, enqueue
from .logging import configure_logging, request_id_var
from .models import CompileRequest, CompileResponse
from .security import contains_forbidden_tex
from .worker import start_worker

MAX_UPLOAD_BYTES = max_upload_bytes()

configure_logging()

app = FastAPI(title='CollaTeX Compile Service', version='0.1.0')


@app.on_event('startup')
def launch_worker() -> None:
    start_worker()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def add_request_id(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = request.headers.get('X-Request-Id') or str(uuid4())
    token = request_id_var.set(request_id)
    try:
        response = await call_next(request)
    finally:
        request_id_var.reset(token)
    response.headers['X-Request-Id'] = request_id
    return response


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
        raise HTTPException(status_code=400, detail='validation error') from exc


@app.post('/compile', response_model=CompileResponse, status_code=202)
async def compile_endpoint(req: CompileRequest = Depends(_parse_compile_request)) -> CompileResponse:
    _validate_request(req)
    job_id = enqueue(req)
    return CompileResponse(jobId=job_id)


@app.get('/jobs/{job_id}')
async def job_status(job_id: str) -> JSONResponse:
    job = JOBS.get(job_id)
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
    if job.pdf_path:
        body['pdfUrl'] = f'/pdf/{job_id}'
    return JSONResponse(content=body)


@app.get('/pdf/{job_id}')
async def get_pdf(job_id: str) -> Response:
    job = JOBS.get(job_id)
    if not job or job.status != JobStatus.DONE:
        raise HTTPException(status_code=404, detail='pdf not found')
    headers = {'Cache-Control': 'no-store', 'ETag': '"stub"'}
    if job.pdf_path and Path(job.pdf_path).exists():
        return FileResponse(
            path=str(job.pdf_path),
            media_type='application/pdf',
            filename=f'{job_id}.pdf',
            headers=headers,
        )
    return Response(status_code=404, headers=headers)


def _validate_request(req: CompileRequest) -> None:
    if req.engine != 'tectonic':
        raise HTTPException(status_code=400, detail='unsupported engine')

    if not any(f.path == req.entryFile for f in req.files):
        raise HTTPException(status_code=400, detail='entryFile not in files')

    seen = set()
    total_bytes = 0
    for f in req.files:
        p = Path(f.path)
        if f.path.startswith('/') or '..' in p.parts:
            raise HTTPException(status_code=400, detail=f'invalid path: {f.path}')
        if f.path in seen:
            raise HTTPException(status_code=400, detail=f'duplicate path: {f.path}')
        seen.add(f.path)
        try:
            raw = base64.b64decode(f.contentBase64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f'invalid base64 for {f.path}') from exc
        if contains_forbidden_tex(raw):
            raise HTTPException(status_code=422, detail='shell escape not allowed')
        total_bytes += len(raw)

    if total_bytes > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='payload too large')
