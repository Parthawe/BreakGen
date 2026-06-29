"""Runtime observability helpers for hosted alpha deployments."""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import time
import uuid
from collections.abc import Callable
from typing import Any

from fastapi import Request, Response

from server.config import settings

REQUEST_ID_HEADER = "X-Request-ID"
_REQUEST_ID_MAX_LENGTH = 128
_request_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id",
    default="-",
)


class RequestIdFilter(logging.Filter):
    """Attach the current request ID to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


class JsonLogFormatter(logging.Formatter):
    """Small JSON-lines formatter for production logs."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "time": self.formatTime(record, self.datefmt),
        }
        for key in ("method", "path", "status_code", "duration_ms", "client_ip"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def _normalize_request_id(value: str | None) -> str:
    if not value:
        return uuid.uuid4().hex
    normalized = value.strip()
    if (
        not normalized
        or len(normalized) > _REQUEST_ID_MAX_LENGTH
        or any(char in normalized for char in "\r\n")
    ):
        return uuid.uuid4().hex
    return normalized


def configure_logging() -> None:
    """Configure app logging once for request-correlated JSON logs."""

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())
    handler.addFilter(RequestIdFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


def configure_sentry() -> bool:
    """Initialize Sentry when a DSN is configured.

    Returns whether Sentry was enabled so tests and startup checks can verify the
    production hook without requiring an account or DSN.
    """

    dsn = settings.sentry_dsn.strip()
    if not dsn:
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        logging.getLogger(__name__).warning(
            "Sentry DSN is configured but sentry-sdk is not installed"
        )
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        send_default_pii=False,
    )
    return True


def configure_observability() -> None:
    configure_logging()
    configure_sentry()


async def request_observability_middleware(
    request: Request,
    call_next: Callable[[Request], Any],
) -> Response:
    """Add request IDs and structured access logs to every HTTP request."""

    request_id = _normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
    token = _request_id.set(request_id)
    started = time.perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
    except Exception:
        logging.getLogger("server.request").exception(
            "request failed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                "client_ip": request.client.host if request.client else "unknown",
            },
        )
        raise
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logging.getLogger("server.request").info(
            "request completed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "client_ip": request.client.host if request.client else "unknown",
            },
        )
        _request_id.reset(token)
