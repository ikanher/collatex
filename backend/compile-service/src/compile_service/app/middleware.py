from __future__ import annotations

import time
from uuid import uuid4

from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from structlog import get_logger
from structlog.contextvars import bind_contextvars, unbind_contextvars

from ..logging import request_id_var

logger = get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get('X-Request-Id') or str(uuid4())
        request.state.request_id = request_id
        token = request_id_var.set(request_id)
        bind_contextvars(request_id=request_id)
        logger.info('request_start', path=request.url.path, method=request.method)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            latency_ms = int((time.perf_counter() - start) * 1000)
            status = getattr(response, 'status_code', 500)
            logger.info(
                'request_end',
                path=request.url.path,
                method=request.method,
                status=status,
                latency_ms=latency_ms,
            )
            request_id_var.reset(token)
            unbind_contextvars('request_id')
        response.headers['X-Request-Id'] = request_id
        return response
