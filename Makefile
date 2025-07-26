.PHONY: up down dev dev-backend dev-collab test lint typecheck fmt check-node

up:
	docker compose up --build -d

down:
	docker compose down

# Run both backend and Yjs websocket together
dev:
	@$(MAKE) -j 2 dev-backend dev-collab

# Backend only
dev-backend:
	cd backend/compile-service \
	&& uv run uvicorn compile_service.app.main:app --reload --port 8080

# Collab websocket (pin y-websocket and auto-confirm with -y)
dev-collab: check-node
	npx -y y-websocket@1.5.0 --port 1234 --ping-timeout 30000

# Always use dev group tools (pytest-xdist, ruff, mypy)
test:
	cd backend/compile-service && uv run -g dev -m pytest -n auto -q

lint:
	cd backend/compile-service && uv run -g dev ruff check .

typecheck:
	cd backend/compile-service && uv run -g dev mypy -p compile_service

fmt:
	cd backend/compile-service && uv run -g dev ruff format .

check-node:
	@command -v node >/dev/null 2>&1 || { echo "Node.js is required (install Node 20+)."; exit 1; }
