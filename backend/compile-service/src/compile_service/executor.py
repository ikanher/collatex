from __future__ import annotations

import base64
import os
import shutil
import signal
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import structlog
from prometheus_client import Counter, Histogram

from .app.jobs import Job, JobStatus
from .logging import job_id_var
from .sandbox import apply_limits

logger = structlog.get_logger(__name__)

_TECTONIC = os.getenv('TECTONIC_PATH') or shutil.which('tectonic')
_PLACEHOLDER = (
    Path(__file__).resolve().parents[2] / 'static' / 'placeholder.pdf'
)

COMPILE_COUNTER = Counter(
    'collatex_compile_total',
    'Total compile operations',
    labelnames=['status'],
)
COMPILE_DURATION = Histogram(
    'collatex_compile_duration_seconds',
    'Duration of compile jobs in seconds',
)


def run_compile(job: Job) -> None:
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc).isoformat()
    start = time.perf_counter()

    if _TECTONIC is None:
        time.sleep(0.5)
        job.pdf_bytes = _PLACEHOLDER.read_bytes()
        job.status = JobStatus.DONE
        job.error = None
        job.finished_at = datetime.now(timezone.utc).isoformat()
        duration_ms = int((time.perf_counter() - start) * 1000)
        COMPILE_COUNTER.labels(status='stub').inc()
        COMPILE_DURATION.observe(duration_ms / 1000)
        logger.info(
            'compile_finished',
            job_id=job_id_var.get(''),
            status='done',
            duration_ms=duration_ms,
        )
        return

    with tempfile.TemporaryDirectory(prefix='ctex_') as tmpdir:
        workdir = Path(tmpdir)
        for item in job.req.files:
            dest = workdir / item.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(base64.b64decode(item.contentBase64))
        out_dir = workdir / 'out'
        out_dir.mkdir(exist_ok=True)
        cmd = [
            _TECTONIC,
            '-X',
            'compile',
            '--untrusted',
            '--outdir',
            'out',
            job.req.entryFile,
        ]
        limit_hit = False
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=workdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=lambda: apply_limits(
                    job.req.options.maxSeconds,
                    job.req.options.maxMemoryMb or 512,
                ),
            )
            try:
                stdout, stderr = proc.communicate(timeout=job.req.options.maxSeconds)
            except subprocess.TimeoutExpired:
                proc.kill()
                stdout, stderr = proc.communicate()
                job.status = JobStatus.ERROR
                job.error = 'timeout'
            else:
                combined = (stdout + stderr).decode(errors='replace')
                job.compile_log = combined[-32_000:]
                if proc.returncode == 0:
                    pdf_path = out_dir / (Path(job.req.entryFile).stem + '.pdf')
                    if pdf_path.exists():
                        job.pdf_bytes = pdf_path.read_bytes()
                        job.status = JobStatus.DONE
                    else:
                        job.status = JobStatus.ERROR
                        job.error = 'output missing'
                else:
                    if proc.returncode in (-signal.SIGXCPU, -signal.SIGKILL):
                        job.status = JobStatus.ERROR
                        job.error = 'resource limit exceeded'
                        limit_hit = True
                    else:
                        job.status = JobStatus.ERROR
                        job.error = stderr[:4000].decode(errors='replace')
                        limit_hit = False
        except Exception as exc:
            job.status = JobStatus.ERROR
            job.error = str(exc)
            limit_hit = False
        finally:
            job.finished_at = datetime.now(timezone.utc).isoformat()
            duration_ms = int((time.perf_counter() - start) * 1000)
            if limit_hit:
                COMPILE_COUNTER.labels(status='limit').inc()
            else:
                COMPILE_COUNTER.labels(status=job.status.value).inc()
            COMPILE_DURATION.observe(duration_ms / 1000)
            logger.info(
                'compile_finished',
                job_id=job_id_var.get(''),
                status=job.status.value,
                duration_ms=duration_ms,
            )
