from __future__ import annotations

import re

_pattern = re.compile(rb'\\write18')


def contains_forbidden_tex(data: bytes) -> bool:
    return bool(_pattern.search(data))
