from __future__ import annotations

import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, Optional

from .models import CompileRequest
from .storage import artifacts_dir


class JobStatus(str, Enum):
    queued = 'queued'
    running = 'running'
    done = 'done'
    error = 'error'


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.queued
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    pdf_path: Optional[Path] = None
    log_path: Optional[Path] = None
    error: Optional[str] = None


class JobStore:
    def __init__(self) -> None:
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self) -> Job:
        jid = uuid.uuid4().hex
        job = Job(id=jid)
        with self._lock:
            self._jobs[jid] = job
        return job

    def get(self, jid: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(jid)

    def update(self, jid: str, **fields) -> None:
        with self._lock:
            job = self._jobs[jid]
            for k, v in fields.items():
                setattr(job, k, v)


JOBS = JobStore()


def _write_sources(tmpdir: Path, req: CompileRequest) -> None:
    for item in req.files:
        data = item.decode()
        dest = tmpdir / item.path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)


def _tectonic_args(main: str, outdir: Path) -> list[str]:
    # Hardened defaults: no shell escape; minimal network (tectonic fetches packages when needed)
    return [
        'tectonic',
        main,
        '--outdir',
        str(outdir),
        '--synctex',
        'off',
        '--keep-logs',
        '--print',
        'stderr',
        '--chdir',
        '.',  # run relative to tmpdir
    ]


def run_compile(job: Job, req: CompileRequest, timeout_s: int = 30) -> None:
    job.started_at = time.time()
    job.status = JobStatus.running

    tmpdir = Path(tempfile.mkdtemp(prefix=f'collatex-{job.id}-'))
    outdir = tmpdir / 'out'
    outdir.mkdir(parents=True, exist_ok=True)
    log_path = tmpdir / 'compile.log'
    job.log_path = log_path

    try:
        _write_sources(tmpdir, req)
        args = _tectonic_args(req.main, outdir)
        with subprocess.Popen(
            args,
            cwd=tmpdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        ) as proc:
            try:
                stdout, _ = proc.communicate(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                proc.kill()
                stdout = (stdout or '') + '\n[timeout] compile exceeded time limit'
        log_path.write_text(stdout or '', encoding='utf-8')

        if proc.returncode != 0:
            job.status = JobStatus.error
            job.error = f'tectonic exited with {proc.returncode}'
            return

        # Resolve PDF path
        main_pdf = Path(req.main).with_suffix('.pdf').name
        pdf_src = outdir / main_pdf
        if not pdf_src.exists():
            job.status = JobStatus.error
            job.error = 'PDF not produced'
            return

        # Persist artifact
        dest = artifacts_dir() / f'{job.id}.pdf'
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pdf_src, dest)
        job.pdf_path = dest
        job.status = JobStatus.done
    except Exception as exc:  # noqa: BLE001
        job.status = JobStatus.error
        job.error = f'exception: {exc!r}'
    finally:
        job.finished_at = time.time()
        # Keep tmpdir for debugging; consider cleanup policy later.


def enqueue(req: CompileRequest) -> str:
    job = JOBS.create()
    # Validate payload early; may raise ValueError -> caller returns 400.
    req.validate_total_size()

    t = threading.Thread(target=run_compile, args=(job, req), daemon=True)
    t.start()
    return job.id
