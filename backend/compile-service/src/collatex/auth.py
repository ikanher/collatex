from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import JWTError, jwt


_SECRET = os.getenv('COLLATEX_SECRET', 'changeme')


def create_access_token(user_id: str, *, expires: int = 3600) -> str:
    """Return a JWT for ``user_id`` expiring in ``expires`` seconds."""
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(seconds=expires),
    }
    return jwt.encode(payload, _SECRET, algorithm='HS256')


def decode_token(token: str) -> str:
    """Return the user id encoded in ``token`` or raise 401."""
    try:
        data = jwt.decode(token, _SECRET, algorithms=['HS256'])
    except JWTError as exc:  # pragma: no cover - fast path
        raise HTTPException(status_code=401, detail='invalid token') from exc
    user_id = data.get('sub')
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail='invalid token')
    return user_id
