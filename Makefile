.PHONY: dev dev-collab dev-frontend test lint typecheck check-node

dev: dev-collab dev-frontend

dev-collab: check-node
	 npm --prefix apps/collab_gateway run dev

dev-frontend: check-node
	 npm --prefix apps/frontend run dev

lint:
	 npm --prefix apps/collab_gateway run lint
	 npm --prefix apps/frontend run lint

test:
	 npm --prefix apps/collab_gateway run test
	 npm --prefix apps/frontend run test

typecheck:
	 npm --prefix apps/frontend run typecheck

check-node:
	 @command -v node >/dev/null 2>&1 || { echo "Node.js is required (install Node 20+)."; exit 1; }
