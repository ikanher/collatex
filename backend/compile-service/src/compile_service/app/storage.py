from __future__ import annotations

from pathlib import Path

from .config import artifacts_dir as _artifacts_dir


def artifacts_dir() -> Path:
    """Return the directory where compiled PDFs are stored."""
    return _artifacts_dir()
