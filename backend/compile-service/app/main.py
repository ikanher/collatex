from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .jobs import JOBS, enqueue
from .models import CompileRequest, CompileResponse

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
    try:
        job_id = enqueue(req)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    return CompileResponse(jobId=job_id)


@app.get('/jobs/{job_id}')
def job_status(job_id: str) -> JSONResponse:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')

    body: Dict[str, Any] = {
        'status': job.status,
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
