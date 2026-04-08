.PHONY: dev dev-client dev-server install test clean

# Install all dependencies
install:
	cd client && pnpm install
	cd server && python3 -m uv sync

# Run both frontend and backend dev servers
dev:
	@echo "Starting BreakGen development servers..."
	@echo "  Frontend: http://localhost:5173"
	@echo "  Backend:  http://localhost:8000"
	@echo "  API docs: http://localhost:8000/docs"
	@make -j2 dev-client dev-server

dev-client:
	cd client && pnpm dev

dev-server:
	cd server && python3 -m uv run uvicorn server.main:app --reload --host 0.0.0.0 --port 8000

# Run server tests
test:
	cd server && python3 -m uv run pytest -v

# Build frontend for production
build:
	cd client && pnpm build

# Clean generated files
clean:
	rm -rf client/dist client/node_modules server/.venv server/__pycache__ server/**/__pycache__ *.db
