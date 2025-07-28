FROM node:20-alpine AS build
ARG VITE_API_TOKEN=changeme
WORKDIR /app
COPY . .
RUN npm ci && VITE_API_TOKEN=$VITE_API_TOKEN npm run build
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

