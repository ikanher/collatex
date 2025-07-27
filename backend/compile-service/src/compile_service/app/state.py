from __future__ import annotations

import os
import importlib

if os.getenv('COLLATEX_STATE', 'memory') in {'redis', 'fakeredis'}:
    backend_impl = importlib.import_module('compile_service.app.state_redis')
else:
    backend_impl = importlib.import_module('compile_service.app.state_memory')

add_job = backend_impl.add_job
get_job = backend_impl.get_job
update_job_status = backend_impl.update_job_status
list_jobs = backend_impl.list_jobs
init = getattr(backend_impl, 'init')
