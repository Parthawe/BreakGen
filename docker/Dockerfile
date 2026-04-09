FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy server dependency files first (for layer caching)
COPY server/pyproject.toml server/uv.lock /app/server/

# Install dependencies
RUN cd server && uv sync --frozen

# Copy server source
COPY server/ /app/server/

# Create data directory
RUN mkdir -p /app/data/artifacts

ENV PYTHONPATH=/app
ENV BREAKGEN_DATABASE_URL=sqlite+aiosqlite:///./data/breakgen.db
ENV BREAKGEN_ARTIFACTS_DIR=./data/artifacts
ENV BREAKGEN_DEBUG=false

EXPOSE 8000

CMD ["uv", "run", "--directory", "server", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
