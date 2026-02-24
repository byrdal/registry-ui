# Build stage
FROM node:24-alpine AS build
WORKDIR /app

COPY package* ./
RUN npm ci

COPY nuxt.config.ts ./
COPY pages ./pages
COPY layouts ./layouts
COPY public ./public
COPY server ./server
COPY scripts ./scripts

RUN npm run build

# Runtime stage
FROM node:24-alpine AS runtime
WORKDIR /app

# supercronic (multi-arch)
ARG TARGETARCH
RUN wget -q "https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-${TARGETARCH}" -O /supercronic \
    && chmod +x /supercronic

ENV NODE_ENV=production
ENV DB_PATH=/data/registry.db

COPY --from=build /app/.output /app/.output

# Install only production dependencies (better-sqlite3 native module)
COPY package* ./
RUN npm pkg delete scripts.postinstall && npm ci --omit=dev

COPY scripts /app/scripts
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
