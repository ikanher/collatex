from __future__ import annotations

import os

from fastapi import HTTPException, Request


async def verify_token(request: Request) -> str | None:
    expected = os.getenv('COLLATEX_API_TOKEN')
    header = request.headers.get('Authorization')
    token = None
    if header and header.startswith('Bearer '):
        token = header.split(' ', 1)[1]
    if token is None:
        token = request.query_params.get('token')
    if expected and token != expected:
        raise HTTPException(status_code=401, detail='unauthorized')
    return token
