from __future__ import annotations

import asyncio
import json
from queue import Queue, Empty
from typing import Any, Dict, cast

_QUEUE: Queue[str] = Queue()

async def enqueue_job(job_id: str, request_json: str) -> None:
    payload = json.dumps({'job_id': job_id, 'request_json': request_json})
    _QUEUE.put(payload)

async def dequeue_job() -> Dict[str, Any] | None:
    try:
        data = _QUEUE.get_nowait()
    except Empty:
        await asyncio.sleep(0.1)
        return None
    _QUEUE.task_done()
    return cast(Dict[str, Any], json.loads(data))
