from __future__ import annotations

import base64
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import structlog
from prometheus_client import Counter, Histogram

from .app.jobs import Job, JobStatus
from .logging import job_id_var

logger = structlog.get_logger(__name__)

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

    with tempfile.TemporaryDirectory(prefix='ctex_') as tmpdir:
        workdir = Path(tmpdir)
        for item in job.req.files:
            dest = workdir / item.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(base64.b64decode(item.contentBase64))
        out_dir = workdir / 'out'
        out_dir.mkdir(exist_ok=True)
        cmd = [
            'tectonic',
            '-X',
            'compile',
            '--untrusted',
            '--outdir',
            'out',
            job.req.entryFile,
        ]
        try:
            proc = subprocess.run(
                cmd,
                cwd=workdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=job.req.options.maxSeconds,
            )
            job.logs = (proc.stdout + proc.stderr).decode(errors='replace')
            if proc.returncode == 0:
                pdf_path = out_dir / (Path(job.req.entryFile).stem + '.pdf')
                if pdf_path.exists():
                    job.pdf_bytes = pdf_path.read_bytes()
                    job.status = JobStatus.DONE
                else:
                    job.status = JobStatus.ERROR
                    job.error = 'output missing'
            else:
                job.status = JobStatus.ERROR
                job.error = proc.stderr[:4000].decode(errors='replace')
        except subprocess.TimeoutExpired as exc:
            stderr = b''
            if exc.stderr:
                stderr = exc.stderr if isinstance(exc.stderr, bytes) else exc.stderr.encode()
            job.status = JobStatus.ERROR
            job.error = stderr[:4000].decode(errors='replace') if stderr else 'timeout'
        finally:
            job.finished_at = datetime.now(timezone.utc).isoformat()
            duration_ms = int((time.perf_counter() - start) * 1000)
            COMPILE_COUNTER.labels(status=job.status.value).inc()
            COMPILE_DURATION.observe(duration_ms / 1000)
            logger.info(
                'compile_finished',
                job_id=job_id_var.get(''),
                status=job.status.value,
                duration_ms=duration_ms,
            )
