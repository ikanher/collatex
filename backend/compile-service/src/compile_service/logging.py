from __future__ import annotations

import logging
import os
from contextvars import ContextVar

import structlog

# Context variables to expose request and job identifiers
request_id_var: ContextVar[str] = ContextVar('request_id', default='')
job_id_var: ContextVar[str] = ContextVar('job_id', default='')


def configure_logging() -> None:
    """Configure structlog for JSON output."""
    level_name = os.getenv('COLLATEX_LOG_LEVEL', 'DEBUG').upper()
    level = getattr(logging, level_name, logging.DEBUG)
    logging.basicConfig(level=level, force=True)
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.stdlib.LoggerFactory(),
        processors=[
            structlog.processors.TimeStamper(fmt='iso', utc=True, key='timestamp'),
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.EventRenamer('event'),
            structlog.processors.JSONRenderer(),
        ],
    )
