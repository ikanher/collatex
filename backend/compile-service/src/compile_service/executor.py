from __future__ import annotations

import base64
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from .app.jobs import Job, JobStatus


def run_compile(job: Job) -> None:
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc).isoformat()

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
