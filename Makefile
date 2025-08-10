.RECIPEPREFIX := >
.PHONY: up down dev dev-collab dev-frontend dev-redis test lint typecheck fmt check-node

up:
>docker compose up --build -d

down:
>docker compose down

dev:
>@$(MAKE) -j 2 dev-collab dev-frontend

dev-collab: check-node
>npm --prefix apps/collab_gateway run dev

dev-frontend: check-node
>npm --prefix apps/frontend run dev

dev-redis:
>docker run --rm -p 6379:6379 redis:7-alpine

test:
>npm --prefix apps/collab_gateway run test
>npm --prefix apps/frontend run test

lint:
>npm --prefix apps/collab_gateway run lint
>npm --prefix apps/frontend run lint

typecheck:
>npm --prefix apps/frontend run typecheck

fmt:
>npm --prefix apps/frontend run lint -- --fix || true

check-node:
>@command -v node >/dev/null 2>&1 || { echo "Node.js is required (install Node 20+)."; exit 1; }

