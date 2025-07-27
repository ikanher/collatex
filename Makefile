.PHONY: up down dev dev-backend dev-collab dev-redis test lint typecheck fmt check-node

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
	npm --prefix apps/collab_gateway run dev

dev-redis:
	docker run --rm -p 6379:6379 redis:7-alpine

dev-worker:
	cd backend/compile-service && uv run compile_service.worker:main

# Always use dev group tools (pytest-xdist, ruff, mypy)
test:
	if [ "$$COLLATEX_STATE" = "redis" ]; then \
	python scripts/check_redis.py; \
	fi
	cd backend/compile-service && uv run --extra dev -m pytest -n auto -q

lint:
	cd backend/compile-service && uv run --extra dev ruff check .

typecheck:
	cd backend/compile-service && uv run --extra dev mypy -p compile_service

fmt:
	cd backend/compile-service && uv run --extra dev ruff format .

check-node:
	@command -v node >/dev/null 2>&1 || { echo "Node.js is required (install Node 20+)."; exit 1; }
