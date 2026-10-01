# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Nuxt 4 (Vue 3 + TypeScript) full-stack web UI for browsing Docker container registries. A background script syncs metadata from the Docker Registry HTTP API v2 into a local SQLite database; the Nuxt server exposes REST endpoints that the Vue frontend consumes.

## Development Commands

```bash
# Init database then start dev server (prerequisites: a registry on localhost:4000)
DB_PATH="./.data/db/registry.db" node ./scripts/migrate-db.mjs
DB_PATH="./.data/db/registry.db" REGISTRY_URL="http://localhost:4000" node ./scripts/refresh-registry.mjs
NUXT_DB_PATH="./.data/db/registry.db" NUXT_REGISTRY_URL="http://localhost:4000" NUXT_PUBLIC_REGISTRY_TITLE="My Registry" NUXT_PUBLIC_REGISTRY_PUBLIC_URL="localhost:4000" npm run dev

# Seed database with random data (no registry required)
DB_PATH="./.data/db/registry.db" node ./scripts/seed-db.mjs

# Production build
npm run build
npm start   # runs .output/server/index.mjs
```

There is no test runner or linter configured.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DB_PATH` | `/data/registry.db` | SQLite database file path |
| `REGISTRY_URL` | `http://registry:5000` | Docker Registry v2 base URL (for internal API calls) |
| `REGISTRY_PUBLIC_URL` | `localhost:5000` | Public-facing registry URL shown in pull commands |
| `REGISTRY_USERNAME` | (empty) | Optional basic auth username |
| `REGISTRY_PASSWORD` | (empty) | Optional basic auth password |
| `REGISTRY_TITLE` | `Registry UI` | Page title shown in the UI |
| `CRON_SCHEDULE` | `*/10 * * * *` | Refresh interval (Docker only) |

**Note:** To enable image deletion, the Docker Registry must have `REGISTRY_STORAGE_DELETE_ENABLED=true` set. Without this, delete operations will return 405 Method Not Allowed.

## Architecture

```
scripts/
  migrate-db.mjs        # Creates tables (idempotent)
  db-schema.mjs          # Schema definition (repos, tags, meta tables)
  refresh-registry.mjs   # Syncs registry → SQLite via Registry API v2
  seed-db.mjs            # Seeds database with random data for development

server/
  utils/db.ts            # better-sqlite3 singleton (getDb())
  api/repos.get.ts       # GET /api/repos — all repos with tags, sizes, last update
  api/sync.get.ts        # GET /api/sync — when the last registry sync completed (footer)
  api/repos/[slug]/tags.get.ts           # GET /api/repos/:slug/images
  api/repos/[slug]/tags/[digest].delete.ts  # DELETE /api/repos/:slug/tags/:digest

pages/
  index.vue              # Dashboard — lists repos with search, storage stats
  repos/[slug].vue       # Repo detail — images grouped by digest, delete button

layouts/default.vue      # Shared header/wrapper

components/ThemeToggle.vue  # Icon-only light/dark switch (inline SVG, no icon library)
composables/useTheme.ts     # Theme state in a cookie, so SSR renders the right class
assets/css/main.css         # Global stylesheet — Tailwind entry + the dark variant
```

**Data flow:** `refresh-registry.mjs` → SQLite → Nitro API handlers → `useFetch()` in Vue pages.

**Database:** SQLite via `better-sqlite3` in WAL mode. Tables: `repos` (name, slug, updated_at) and `tags` (digest, media_type, size_bytes, platform, created_at, last_seen_at). Keyed by `(repo_slug, tag)` with UPSERT on conflict. A key/value `meta` table holds `last_sync_at`, written when a refresh completes. `migrate-db.mjs` runs the whole `IF NOT EXISTS` schema on every start, so new tables reach existing databases.

**Registry refresh:** Fetches the catalog, then for each repo/tag: HEAD for digest, GET for manifest body, GET for config blob. Handles both single-image manifests and manifest lists/OCI indexes. Filters out non-image entries (attestations, SBOMs) by checking `platform.os === "unknown"` and media type. Uses track-and-prune: updates timestamps for all entries found, then deletes entries with old timestamps (repos where `updated_at < current_sync_time` and tags where `last_seen_at < current_sync_time`). This ensures deleted/removed images don't linger in the database.

**Tag grouping:** Tags sharing the same digest are grouped together in the UI. The `/api/repos/:slug/tags` endpoint returns `images` (digest groups) instead of individual tags. Each image shows multiple tag badges. This reflects that operations target digests, not individual tags.

**Storage calculation:** Disk usage is calculated on-demand at the API level by deduplicating sizes by digest. Tags pointing to the same image are only counted once. Total storage and per-repo storage are displayed on the dashboard.

**Image deletion:** The repo detail page includes delete buttons for each image. Deletion flow: UI calls DELETE endpoint → server calls Registry API v2 `DELETE /v2/<name>/manifests/<digest>` (returns 202 Accepted) → server deletes that digest's rows from `tags` → UI refreshes. No full sync runs; the cron refresh reconciles anything else. Requires registry to have deletion enabled (`REGISTRY_STORAGE_DELETE_ENABLED=true`). Uses confirmation dialog before deletion and toast notifications for feedback.

**Dark mode:** Class-based, not `prefers-color-scheme`. `assets/css/main.css` declares `@custom-variant dark (&:where(.dark, .dark *))`, which repoints Tailwind's `dark:` variant at a `.dark` class on `<html>`. The choice lives in a `theme` cookie read by `composables/useTheme.ts`, so SSR renders the class on the first response and there is no flash of the wrong theme. Surfaces are `gray-900` for the page and `gray-800` for cards.

Three things to watch when adding dark styles:

- Anything already dark in light mode needs its own `dark:` value, or it disappears against the `gray-800` card. The repo initial avatars hit this exactly.
- `dark:border-gray-700` sets all four sides and will silently override a `border-l-*` accent. Set the side colour explicitly in the dark variant too.
- For hover, prefer a translucent white (`dark:hover:bg-white/5` for rows, `/8` for buttons) over the next grey shade. One step down the grey scale is a far bigger perceptual jump at the dark end than at the light end, so `gray-800` to `gray-700` reads about six times louder than `white` to `gray-50`.

## Key Conventions

- **Package manager:** npm with `save-exact=true`
- **Styling:** Tailwind CSS 4 via `@tailwindcss/vite` — all styling is utility classes, no component library
  - Tailwind is imported from `assets/css/main.css`, registered as a global stylesheet in `nuxt.config.ts`. It must stay global: importing it from a component `<style>` block scopes it to that route's chunk and leaves other routes unstyled.
  - Tag badges: `border border-sky-100 bg-sky-50 text-sky-700` plus `px-2 py-0.5 text-xs font-mono rounded`
  - Icons are inline SVG (`fill="none" stroke="currentColor" viewBox="0 0 24 24"`), no icon library
- **Vue style:** Composition API with `<script setup>`, `ref()`, `computed()`, `useFetch()`
- **API routes:** Nitro `defineEventHandler()` pattern, params via `getRouterParam()`
- **Timestamps:** ISO 8601 strings throughout (JS `.toISOString()`, stored as TEXT in SQLite)
  - Formatted in UI as "09 Feb 2025, 14:22:33" (en-GB locale)
- **Slugs:** Repo names are slugified (`lowercase → replace non-alnum with hyphens → collapse`) for URL-safe identifiers
- **Utilities:** `formatBytes()` and `formatDate()` helpers are duplicated in both page components

## Docker

Multi-stage Dockerfile (node:24-alpine). Runtime uses supercronic for scheduled refreshes. Entrypoint runs migration → initial refresh → starts cron + Nuxt server. A `docker-compose.yml` provides a local registry on port 4000 for development.

## CI/CD

GitHub Actions workflow (`.github/workflows/docker-build.yml`) automatically builds and pushes Docker images to Docker Hub. Triggers on:
- Push to main/master branch → tagged as `latest`
- Version tags (e.g., `v1.2.3`) → tagged as `1.2.3`, `1.2`, `1`, and the full version
- Pull requests → builds but doesn't push (validation only)
- Manual workflow dispatch

Images are multi-platform (linux/amd64, linux/arm64) and use GitHub Actions cache for faster builds.

**Required secrets:** Set `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` in GitHub repository secrets (Settings → Secrets and variables → Actions). The token should be a Docker Hub access token, not your password.
