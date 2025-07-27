from __future__ import annotations

import os
import socket
import urllib.parse

import pytest


def require_redis() -> None:
    """Skip tests if Redis isn't reachable."""
    url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or 'localhost'
    port = parsed.port or 6379
    try:
        with socket.create_connection((host, port), timeout=1):
            return
    except OSError:
        pytest.skip('Redis not available', allow_module_level=True)
