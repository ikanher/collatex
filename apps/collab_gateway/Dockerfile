FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev && npm run build
CMD ["node", "dist/index.js"]

