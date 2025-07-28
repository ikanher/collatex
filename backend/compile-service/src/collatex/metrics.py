from __future__ import annotations

from prometheus_client import Counter, Histogram

COMPILE_COUNTER = Counter(
    'compile_total',
    'Total compile jobs',
    labelnames=['status', 'project_token'],
)

COMPILE_DURATION = Histogram(
    'compile_duration_seconds',
    'Duration of compile tasks in seconds',
    labelnames=['project_token'],
)
