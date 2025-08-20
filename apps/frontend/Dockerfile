FROM node:20-alpine AS build
ARG VITE_API_ORIGIN=https://localhost:1234
ARG VITE_WS_URL=wss://localhost:1234

WORKDIR /app

# better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# bring in the rest of the source
COPY . .

# expose Vite vars to the build
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN \
    VITE_WS_URL=$VITE_WS_URL

RUN npx vite build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# let nginx entrypoint envsubst this at runtime
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
