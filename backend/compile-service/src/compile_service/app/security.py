from __future__ import annotations

import re

_patterns = [
    re.compile(rb'\\write\d*'),
    re.compile(rb'\\input'),
    re.compile(rb'\\openout'),
    re.compile(rb'\\read'),
]


def contains_forbidden_tex(data: bytes) -> bool:
    for pattern in _patterns:
        if pattern.search(data):
            return True
    return False
