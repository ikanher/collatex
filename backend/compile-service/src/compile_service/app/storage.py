from __future__ import annotations

import os
from pathlib import Path


def artifacts_dir() -> Path:
    base = os.getenv('ARTIFACTS_DIR', 'var/artifacts')
    return Path(base).absolute()
