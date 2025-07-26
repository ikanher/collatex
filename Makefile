.PHONY: dev-backend test lint typecheck fmt

dev-backend:
	cd backend/compile-service && uv run uvicorn app.main:app --reload --port 8080

test:
	cd backend/compile-service && uv run -m pytest -n auto -q

lint:
	cd backend/compile-service && uv run ruff check .

typecheck:
	cd backend/compile-service && uv run mypy app

fmt:
	cd backend/compile-service && uv run ruff format .
