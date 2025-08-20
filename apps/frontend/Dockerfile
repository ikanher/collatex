FROM node:20-alpine AS build
ARG VITE_API_TOKEN=changeme
WORKDIR /app
COPY . .
RUN npm ci
RUN npx vite build
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

