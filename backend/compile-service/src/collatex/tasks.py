from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from celery import Celery  # type: ignore
from celery.app.task import Task  # type: ignore

from time import perf_counter

from .models import JobStatus
from .redis_store import get_job, save_job, publish_status
from .metrics import COMPILE_COUNTER, COMPILE_DURATION

celery_app = Celery('collatex', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
celery_app.conf.task_default_queue = 'compile'


@celery_app.task(bind=True)  # type: ignore[misc]
def compile_task(self: Task, job_id: str, tex_source: str) -> None:
    job = get_job(job_id)
    if job is None:
        return
    job.status = JobStatus.RUNNING
    save_job(job)
    publish_status(job)
    start = perf_counter()

    storage = Path('storage')
    storage.mkdir(exist_ok=True)
    pdf_path = storage / f'{job_id}.pdf'

    tectonic = shutil.which('tectonic')
    log = ''
    if tectonic:
        with tempfile.TemporaryDirectory() as tmp:
            tex_file = Path(tmp) / 'main.tex'
            tex_file.write_text(tex_source)
            proc = subprocess.run(
                [tectonic, 'main.tex', '-o', 'out.pdf', '--synctex=0'],
                cwd=tmp,
                capture_output=True,
                text=True,
            )
            log = proc.stdout + proc.stderr
            if proc.returncode == 0 and (Path(tmp) / 'out.pdf').exists():
                shutil.move(str(Path(tmp) / 'out.pdf'), pdf_path)
                job.status = JobStatus.SUCCEEDED
            else:
                job.status = JobStatus.FAILED
    else:
        placeholder = Path(__file__).resolve().parents[2] / 'static' / 'placeholder.pdf'
        shutil.copy(placeholder, pdf_path)
        job.status = JobStatus.SUCCEEDED
        log = 'placeholder used'

    job.pdf_path = str(pdf_path)
    job.log = log[-4000:] if log else None
    save_job(job)
    duration = perf_counter() - start
    status_label = 'succeeded' if job.status == JobStatus.SUCCEEDED else 'failed'
    COMPILE_COUNTER.labels(status=status_label).inc()
    COMPILE_DURATION.observe(duration)
    publish_status(job)
