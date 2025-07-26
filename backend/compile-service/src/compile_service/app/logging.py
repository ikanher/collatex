from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar('request_id', default='')
job_id_var: ContextVar[str] = ContextVar('job_id', default='')


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # pragma: no cover - small
        log: dict[str, Any] = {
            'timestamp': datetime.utcfromtimestamp(record.created).isoformat() + 'Z',
            'level': record.levelname.lower(),
            'message': record.getMessage(),
            'request_id': request_id_var.get(''),
            'job_id': job_id_var.get(''),
        }
        return json.dumps(log)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
