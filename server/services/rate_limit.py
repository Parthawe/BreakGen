"""Small request rate limiter for alpha-facing HTTP endpoints.

This is an in-process guardrail for brute-force and expensive-route abuse.
Production multi-worker deployments should replace or back this with Redis or
another shared store so limits survive restarts and apply across workers.
"""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Deque

from fastapi import HTTPException, Request

from server.config import settings


_rate_events: dict[str, Deque[datetime]] = defaultdict(deque)


def _is_trusted_proxy(host: str | None) -> bool:
    if not host:
        return False
    return host in set(settings.trusted_proxy_host_list)


def client_rate_key(request: Request) -> str:
    """Return a rate-limit identity without trusting spoofable proxy headers.

    Resolution order:
    1. A platform client-IP header (``trusted_client_ip_header``), if configured.
       Hosts like Fly.io set ``Fly-Client-IP`` and strip any inbound copy, so it
       is not client-spoofable. This is the correct source behind such a proxy,
       where the socket peer is always the platform's internal proxy address.
    2. The leftmost ``X-Forwarded-For`` value, but only when the socket peer is a
       configured trusted proxy.
    3. The raw socket peer (safe default; never trusts client-supplied headers).
    """
    trusted_header = settings.trusted_client_ip_header.strip()
    if trusted_header:
        header_value = request.headers.get(trusted_header, "").strip()
        if header_value:
            return header_value.split(",", 1)[0].strip()

    socket_host = request.client.host if request.client and request.client.host else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for and _is_trusted_proxy(socket_host):
        return forwarded_for.split(",", 1)[0].strip()
    return socket_host


def enforce_rate_limit(
    request: Request,
    *,
    scope: str,
    limit: int,
    window_seconds: int = 60,
    identity: str | None = None,
) -> None:
    """Raise 429 if a request scope exceeds its moving-window limit."""
    now = datetime.now(timezone.utc)
    window = timedelta(seconds=window_seconds)
    key = f"{scope}:{identity or client_rate_key(request)}"
    events = _rate_events[key]

    window_start = now - window
    while events and events[0] < window_start:
        events.popleft()

    if len(events) >= limit:
        retry_after = max(1, int((events[0] + window - now).total_seconds())) if events else window_seconds
        raise HTTPException(
            status_code=429,
            detail="Too many requests; try again later",
            headers={"Retry-After": str(retry_after)},
        )

    events.append(now)


def reset_rate_limits() -> None:
    """Clear in-process counters for tests."""
    _rate_events.clear()
