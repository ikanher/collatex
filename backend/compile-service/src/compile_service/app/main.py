from __future__ import annotations

import os
import uuid
from datetime import datetime

import redis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from collatex.models import Job, JobStatus
from collatex.redis_store import init as store_init, get_job, save_job
from collatex.tasks import compile_task

app = FastAPI(title='CollaTeX Compile Service', version='0.1.0')


@app.on_event('startup')
def setup() -> None:
    url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    client = redis.from_url(url)  # type: ignore[no-untyped-call]
    store_init(client)
    app.state.redis = client


@app.on_event('shutdown')
def cleanup() -> None:
    client = getattr(app.state, 'redis', None)
    if client is not None:
        client.close()


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


@app.get('/healthz')
def healthz() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/compile', status_code=202)
async def compile_endpoint(req: CompileRequest) -> Response:
    job_id = str(uuid.uuid4())
    job = Job(id=job_id, created_at=datetime.utcnow())
    await run_in_threadpool(save_job, job)
    compile_task.delay(job_id, req.tex)
    return Response(status_code=202, headers={'Location': f'/jobs/{job_id}'})


@app.get('/jobs/{job_id}')
async def job_status(job_id: str) -> JSONResponse:
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


@app.get('/pdf/{job_id}')
async def get_pdf(job_id: str) -> FileResponse:
    job = await run_in_threadpool(get_job, job_id)
    if not job or job.status != JobStatus.SUCCEEDED or not job.pdf_path:
        raise HTTPException(status_code=404, detail='pdf not found')
    return FileResponse(job.pdf_path, media_type='application/pdf')
