from __future__ import annotations

import resource


def apply_limits(cpu_seconds: int, memory_mb: int) -> None:
    """Set RLIMIT_CPU and RLIMIT_AS before exec in child."""
    cpu = max(cpu_seconds, 1)
    mem_bytes = max(memory_mb, 1) * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
