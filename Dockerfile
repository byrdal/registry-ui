# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package* ./
RUN npm ci

COPY nuxt.config.ts ./
COPY pages ./pages
COPY layouts ./layouts
COPY server ./server
COPY scripts ./scripts

RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app

# supercronic
ADD https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 /supercronic
RUN chmod +x /supercronic

ENV NODE_ENV=production
ENV DB_PATH=/data/registry.db

COPY --from=build /app/.output /app/.output
COPY --from=build /app/node_modules /app/node_modules

COPY scripts /app/scripts
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
