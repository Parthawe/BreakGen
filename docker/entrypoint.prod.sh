#!/usr/bin/env sh
set -eu

cd /app

PORT="${PORT:-8000}"
WORKERS="${BREAKGEN_UVICORN_WORKERS:-1}"

if [ "${BREAKGEN_DEBUG:-false}" = "false" ]; then
  uv run --directory server alembic -c ../alembic.ini upgrade head
fi

exec uv run --directory server uvicorn server.main:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers "$WORKERS"
