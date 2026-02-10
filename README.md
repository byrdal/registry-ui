# registry-ui

## Development

Run migrations

```shell
DB_PATH="./.data/db/registry.db" node ./scripts/migrate-db.mjs
```

Run initial sync

```shell
DB_PATH="./.data/db/registry.db" REGISTRY_URL="http://localhost:4000" node ./scripts/refresh-registry.mjs
```

Start dev server

```shell
DB_PATH="./.data/db/registry.db" \
REGISTRY_URL="http://localhost:4000" \
REGISTRY_TITLE="My Registry" \
npm run dev
```
