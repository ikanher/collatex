FROM node:20-alpine
WORKDIR /app
COPY . .
# Install all deps including dev tools (for tsc), then prune
RUN npm ci && npm run build && npm prune --omit=dev
CMD ["node", "dist/index.js"]

