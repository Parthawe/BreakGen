FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy server files
COPY server/ /app/server/

# Install dependencies
RUN cd server && uv sync

# Create data directory
RUN mkdir -p /app/data/artifacts

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
