from __future__ import annotations

import base64
import logging
import shutil
import subprocess
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

from .config import artifacts_dir, compile_timeout_seconds
from .jobs import JOB_QUEUE, JobStatus
from .state import get_job, update_job_status
from .logging import job_id_var
from .models import CompileOptions


def _set_limits(opts: CompileOptions) -> None:
    try:
        import resource

        mem = opts.maxMemoryMb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
    except Exception:
        pass


def _run_tectonic(workdir: Path, entry: str, opts: CompileOptions) -> tuple[int, str]:
    cmd = [
        'tectonic',
        '-X',
        'compile',
        entry,
        '--outdir',
        str(workdir),
        '--untrusted',
        '--print',
    ]
    if opts.synctex:
        cmd.append('--synctex')

    try:
        proc = subprocess.run(
            cmd,
            cwd=workdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=opts.maxSeconds or compile_timeout_seconds(),
            preexec_fn=lambda: _set_limits(opts),
        )
        return proc.returncode, proc.stdout
    except subprocess.TimeoutExpired as exc:
        out: str = ''
        if isinstance(exc.stdout, bytes):
            out = exc.stdout.decode()
        elif exc.stdout:
            out = exc.stdout
        return -1, out + '\nTimed out'


def _compile_job(job_id: str) -> None:
    job = get_job(job_id)
    if not job:
        return

    token = job_id_var.set(job_id)
    update_job_status(job_id, JobStatus.RUNNING, started_at=datetime.now(timezone.utc).isoformat())
    logging.info('job started')

    with tempfile.TemporaryDirectory(prefix='ctex_') as tmp:
        workdir = Path(tmp)
        for f in job.req.files:
            path = workdir / f.path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(base64.b64decode(f.contentBase64))

        try:
            code, out = _run_tectonic(workdir, job.req.entryFile, job.req.options)
            job.logs = out
        except FileNotFoundError:
            job.error = 'engine not available'
            job.logs = 'tectonic binary not found'
            code = -1
        except Exception as exc:  # pragma: no cover - unexpected crash
            job.error = str(exc)
            job.logs = ''
            code = -1
        pdf = workdir / (Path(job.req.entryFile).stem + '.pdf')

        if code == 0 and pdf.exists():
            dest = artifacts_dir() / f'{job_id}.pdf'
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(pdf, dest)
            job.pdf_path = str(dest)
            job.status = JobStatus.DONE
            logging.info('job completed')
        else:
            job.error = f'compile failed code {code}'
            job.status = JobStatus.ERROR
            logging.info('job failed')

    job.finished_at = datetime.now(timezone.utc).isoformat()
    job_id_var.reset(token)


def _worker_loop() -> None:
    while True:
        job_id = JOB_QUEUE.get()
        try:
            _compile_job(job_id)
        finally:
            JOB_QUEUE.task_done()


def start_worker() -> None:
    thread = threading.Thread(target=_worker_loop, daemon=True)
    thread.start()
