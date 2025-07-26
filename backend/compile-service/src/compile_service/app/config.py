from __future__ import annotations

import os
from pathlib import Path


def max_upload_bytes() -> int:
    return int(os.getenv('MAX_UPLOAD_BYTES', str(2 * 1024 * 1024)))


def compile_timeout_seconds() -> int:
    return int(os.getenv('COMPILE_TIMEOUT_SECONDS', '20'))


def artifacts_dir() -> Path:
    base = os.getenv('ARTIFACTS_DIR', 'var/artifacts')
    p = Path(base).absolute()
    p.mkdir(parents=True, exist_ok=True)
    return p
