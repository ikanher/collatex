from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from celery import Celery  # type: ignore
from celery.app.task import Task  # type: ignore

from time import perf_counter

from structlog import get_logger

from compile_service.logging import job_id_var

from .models import JobStatus
from .redis_store import get_job, save_job, publish_status
from .metrics import COMPILE_COUNTER, COMPILE_DURATION

celery_app = Celery('collatex', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
celery_app.conf.task_default_queue = 'compile'

logger = get_logger(__name__)


@celery_app.task(bind=True)  # type: ignore[misc]
def compile_task(self: Task, job_id: str, tex_source: str) -> None:
    token = job_id_var.set(job_id)
    logger.debug('task_start')
    logger.debug('tex_source', tex=tex_source)
    job = get_job(job_id)
    if job is None:
        logger.debug('task_missing_job')
        job_id_var.reset(token)
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
        logger.debug('tectonic_found', path=tectonic)
        with tempfile.TemporaryDirectory() as tmp:
            tex_file = Path(tmp) / 'main.tex'
            tex_file.write_text(tex_source)
            logger.debug('tex_written', path=str(tex_file), bytes=len(tex_source))
            cmd = [tectonic, '--outdir', '.', '--synctex=0', 'main.tex']
            logger.debug('tectonic_run', cmd=cmd, cwd=str(tmp))
            proc = subprocess.run(
                cmd,
                cwd=tmp,
                capture_output=True,
                text=True,
            )
            logger.debug('tectonic_stdout', stdout=proc.stdout)
            logger.debug('tectonic_stderr', stderr=proc.stderr)
            log = proc.stdout + proc.stderr
            logger.debug('tectonic_finished', returncode=proc.returncode)
            if proc.returncode == 0 and (Path(tmp) / 'main.pdf').exists():
                shutil.move(str(Path(tmp) / 'main.pdf'), pdf_path)
                job.status = JobStatus.SUCCEEDED
            else:
                job.status = JobStatus.FAILED
    else:
        logger.debug('tectonic_missing')
        placeholder = Path(__file__).resolve().parents[2] / 'static' / 'placeholder.pdf'
        shutil.copy(placeholder, pdf_path)
        job.status = JobStatus.SUCCEEDED
        log = 'placeholder used'
        logger.debug('placeholder_used', path=str(placeholder))

    job.pdf_path = str(pdf_path)
    job.log = log[-4000:] if log else None
    save_job(job)
    duration = perf_counter() - start
    status_label = 'succeeded' if job.status == JobStatus.SUCCEEDED else 'failed'
    COMPILE_COUNTER.labels(status=status_label, project_token=job.project_token).inc()
    COMPILE_DURATION.labels(project_token=job.project_token).observe(duration)
    publish_status(job)
    logger.debug('task_end', status=job.status.value, duration_ms=int(duration * 1000))
    job_id_var.reset(token)
