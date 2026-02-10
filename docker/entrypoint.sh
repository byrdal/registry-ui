#!/bin/sh
set -eu

: "${CRON_SCHEDULE:=*/10 * * * *}"   # default every 10 minutes
: "${DB_PATH:=/data/registry.db}"
: "${REGISTRY_URL:=http://registry:5000}"
: "${REGISTRY_TITLE:=Registry UI}"
: "${REGISTRY_PUBLIC_URL:=localhost:5000}"

# Export Nuxt runtime config variables
# These override the defaults in nuxt.config.ts at runtime
export NUXT_REGISTRY_URL="${REGISTRY_URL}"
export NUXT_REGISTRY_USERNAME="${REGISTRY_USERNAME:-}"
export NUXT_REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-}"
export NUXT_DB_PATH="${DB_PATH}"
export NUXT_PUBLIC_REGISTRY_TITLE="${REGISTRY_TITLE}"
export NUXT_PUBLIC_REGISTRY_PUBLIC_URL="${REGISTRY_PUBLIC_URL}"

mkdir -p "$(dirname "$DB_PATH")"

echo "[entrypoint] running database migration..."
node /app/scripts/migrate-db.mjs

# Create crontab for supercronic
cat >/etc/crontab <<EOF
${CRON_SCHEDULE} node /app/scripts/refresh-registry.mjs >>/var/log/refresh.log 2>&1
EOF

echo "[entrypoint] running initial refresh..."
node /app/scripts/refresh-registry.mjs || true

echo "[entrypoint] starting cron + web..."
# Run cron in background, then start Nuxt server
/supercronic /etc/crontab &
exec node /app/.output/server/index.mjs
