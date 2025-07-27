from __future__ import annotations

import importlib
import os

if os.getenv('COLLATEX_STATE', 'memory') == 'redis':
    backend = importlib.import_module('compile_service.queue_redis')
else:
    backend = importlib.import_module('compile_service.queue_memory')

enqueue_job = backend.enqueue_job
dequeue_job = backend.dequeue_job
init = getattr(backend, 'init', lambda _client: None)
