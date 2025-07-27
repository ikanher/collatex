import os
import socket
import sys
import urllib.parse

url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
parts = urllib.parse.urlparse(url)
host = parts.hostname or "localhost"
port = parts.port or 6379
try:
    socket.create_connection((host, port), timeout=1).close()
except OSError:
    print(f"Redis not reachable at {host}:{port}", file=sys.stderr)
    sys.exit(1)
