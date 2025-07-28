from __future__ import annotations

from fastapi import HTTPException, Request

from collatex.auth import decode_token


async def get_current_user(request: Request) -> str:
    header = request.headers.get('Authorization')
    token = None
    if header and header.startswith('Bearer '):
        token = header.split(' ', 1)[1]
    if token is None:
        token = request.query_params.get('token')
    if token is None:
        raise HTTPException(status_code=401, detail='unauthorized')
    return decode_token(token)
