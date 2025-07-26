from __future__ import annotations

import os
import base64

from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .jobs import JOBS, enqueue
from .models import CompileRequest, CompileResponse

MAX_UPLOAD_MB = int(os.getenv('MAX_UPLOAD_MB', '5'))

app = FastAPI(title='CollaTeX Compile Service', version='0.1.0')

# Dev CORS defaults; tighten in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/healthz')
def healthz() -> Dict[str, str]:
    return {'status': 'ok'}


@app.post('/compile', response_model=CompileResponse, status_code=202)
def compile_endpoint(req: CompileRequest) -> CompileResponse:
    _validate_request(req)
    job_id = enqueue(req)
    return CompileResponse(jobId=job_id)


@app.get('/jobs/{job_id}')
def job_status(job_id: str) -> JSONResponse:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    body: Dict[str, Any] = {
        'jobId': job_id,
        'status': job.status,
        'queuedAt': job.queued_at,
        'startedAt': job.started_at,
        'finishedAt': job.finished_at,
        'error': job.error,
    }
    if job.pdf_path:
        body['pdfUrl'] = f'/pdf/{job_id}'
    return JSONResponse(content=body)


@app.get('/pdf/{job_id}')
def get_pdf(job_id: str) -> FileResponse:
    job = JOBS.get(job_id)
    if not job or not job.pdf_path or not Path(job.pdf_path).exists():
        raise HTTPException(status_code=404, detail='pdf not found')
    # Hint for clients
    headers = {'Cache-Control': 'no-store'}
    return FileResponse(
        path=str(job.pdf_path),
        media_type='application/pdf',
        filename=f'{job_id}.pdf',
        headers=headers,
    )

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
        except Exception:
            raise HTTPException(status_code=400, detail=f'invalid base64 for {f.path}')
        if b'\\write18' in raw:
            raise HTTPException(status_code=422, detail='shell escape not allowed')
        total_bytes += len(raw)

    if total_bytes > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail='payload too large')

