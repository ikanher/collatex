FROM node:20-alpine AS build
ARG VITE_API_TOKEN=changeme
ARG VITE_API_ORIGIN=https://localhost:1234/
ARG VITE_WS_URL=wss://localhost:1234/
WORKDIR /app
COPY . .
RUN npm ci && \
    VITE_API_TOKEN=$VITE_API_TOKEN \
    VITE_API_ORIGIN=$VITE_API_ORIGIN \
    VITE_WS_URL=$VITE_WS_URL \
    npx vite build
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

