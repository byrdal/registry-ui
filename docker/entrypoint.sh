#!/bin/sh
set -eu

: "${CRON_SCHEDULE:=*/10 * * * *}"   # default every 10 minutes
: "${DB_PATH:=/data/registry.db}"

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
