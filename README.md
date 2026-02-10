# Registry UI

A modern, lightweight web interface for browsing and managing Docker container registries. Built with Nuxt 4 (Vue 3 + TypeScript) and designed to work seamlessly with any Docker Registry HTTP API v2 compliant registry.

## Features

- **Browse repositories and images** — View all your container images with tags, sizes, and timestamps
- **Smart tag grouping** — Images with the same digest are grouped together, showing all tags at a glance
- **Storage analytics** — Real-time storage usage calculations with deduplication
- **Image deletion** — Delete images directly from the UI (requires registry configuration)
- **Search functionality** — Quickly filter repositories by name
- **Copy pull commands** — One-click copy of `docker pull` commands with the correct registry URL
- **Automatic synchronization** — Background sync keeps the UI up-to-date with your registry
- **Multi-platform support** — Handles both single-platform images and multi-architecture manifest lists

## Quick Start with Docker

The easiest way to use Registry UI is with the pre-built Docker image from Docker Hub.

### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
services:
  registry:
    image: registry:3.0.0
    environment:
      REGISTRY_STORAGE_DELETE_ENABLED: "true"  # Enable image deletion
    ports:
      - "5000:5000"
    volumes:
      - ./registry-data:/var/lib/registry

  registry-ui:
    image: byrdal/registry-ui:latest
    environment:
      REGISTRY_URL: http://registry:5000           # Internal API URL
      REGISTRY_PUBLIC_URL: localhost:5000          # Public pull URL shown in UI
      REGISTRY_TITLE: "My Container Registry"     # Optional: custom title
    ports:
      - "3000:3000"
    volumes:
      - ./registry-ui-data:/data
```

Then start both services:

```bash
docker-compose up -d
```

Access the UI at `http://localhost:3000`

### Using Docker Run

If you already have a Docker registry running:

```bash
docker run -d \
  -p 3000:3000 \
  -e REGISTRY_URL=http://your-registry:5000 \
  -e REGISTRY_PUBLIC_URL=registry.example.com:5000 \
  -e REGISTRY_TITLE="My Registry" \
  -v ./data:/data \
  byrdal/registry-ui:latest
```

## Configuration

Configure Registry UI using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTRY_URL` | `http://registry:5000` | Internal Docker Registry API URL (for backend communication) |
| `REGISTRY_PUBLIC_URL` | `localhost:5000` | Public-facing registry URL shown in pull commands |
| `REGISTRY_TITLE` | `Registry UI` | Page title and header displayed in the UI |
| `REGISTRY_USERNAME` | _(empty)_ | Optional: Basic auth username for private registries |
| `REGISTRY_PASSWORD` | _(empty)_ | Optional: Basic auth password for private registries |
| `DB_PATH` | `/data/registry.db` | SQLite database file location |
| `CRON_SCHEDULE` | `*/10 * * * *` | How often to sync with registry (cron format) |

### Important: Registry URLs

- **`REGISTRY_URL`**: Used by the backend to communicate with the Docker Registry API (e.g., `http://registry:5000` in Docker networks)
- **`REGISTRY_PUBLIC_URL`**: The URL users should use in their `docker pull` commands (e.g., `registry.example.com`, `localhost:5000`)

## Setting Up Your Own Registry

### Option 1: Basic Registry

```bash
docker run -d \
  -p 5000:5000 \
  --name registry \
  -v ./registry-data:/var/lib/registry \
  registry:3.0.0
```

### Option 2: Registry with Deletion Enabled

To enable image deletion through the UI:

```bash
docker run -d \
  -p 5000:5000 \
  --name registry \
  -e REGISTRY_STORAGE_DELETE_ENABLED=true \
  -v ./registry-data:/var/lib/registry \
  registry:3.0.0
```

### Option 3: Registry with Authentication

For production environments with basic authentication:

```bash
# Create htpasswd file
docker run --rm --entrypoint htpasswd registry:3.0.0 -Bbn username password > htpasswd

# Run registry with authentication
docker run -d \
  -p 5000:5000 \
  --name registry \
  -e REGISTRY_AUTH=htpasswd \
  -e REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd \
  -e REGISTRY_AUTH_HTPASSWD_REALM="Registry Realm" \
  -e REGISTRY_STORAGE_DELETE_ENABLED=true \
  -v ./htpasswd:/auth/htpasswd \
  -v ./registry-data:/var/lib/registry \
  registry:3.0.0
```

Then configure Registry UI with credentials:

```bash
docker run -d \
  -p 3000:3000 \
  -e REGISTRY_URL=http://registry:5000 \
  -e REGISTRY_PUBLIC_URL=localhost:5000 \
  -e REGISTRY_USERNAME=username \
  -e REGISTRY_PASSWORD=password \
  -v ./data:/data \
  byrdal/registry-ui:latest
```

## Using the UI

### Browsing Images

The dashboard shows all repositories with:
- Repository name and initial icon
- Available tags (up to 10 shown, with overflow indicator)
- One-click copy of pull commands
- Last update timestamp
- Storage size per repository
- Total storage usage across all images

### Viewing Image Details

Click on any repository name to view:
- All images grouped by digest
- Multiple tags per image (when tags point to the same content)
- Platform information (architecture and OS)
- Creation and last seen timestamps
- Digest and media type
- Delete button (when deletion is enabled)

### Deleting Images

1. Enable deletion in your Docker Registry with `REGISTRY_STORAGE_DELETE_ENABLED=true`
2. Navigate to a repository detail page
3. Click the delete button for any image
4. Confirm the deletion
5. The registry will be automatically refreshed

**Note:** Deletion removes the manifest. To reclaim disk space, you must also run garbage collection on the registry:

```bash
docker exec registry bin/registry garbage-collect /etc/docker/registry/config.yml
```

## Development

### Prerequisites

- Node.js 20+
- npm (with `save-exact=true` configured)
- A Docker registry running locally (for testing)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/byrdal/registry-ui.git
cd registry-ui
```

2. Install dependencies:
```bash
npm install
```

3. Start a local registry (optional, for development):
```bash
docker run -d -p 4000:5000 -e REGISTRY_STORAGE_DELETE_ENABLED=true registry:3.0.0
```

4. Initialize the database:
```bash
NUXT_DB_PATH="./.data/db/registry.db" node ./scripts/migrate-db.mjs
```

5. Sync with the registry:
```bash
NUXT_DB_PATH="./.data/db/registry.db" \
  NUXT_REGISTRY_URL="http://localhost:4000" \
  node ./scripts/refresh-registry.mjs
```

6. Start the development server:
```bash
NUXT_DB_PATH="./.data/db/registry.db" \
  NUXT_REGISTRY_URL="http://localhost:4000" \
  NUXT_REGISTRY_PUBLIC_URL="localhost:4000" \
  NUXT_PUBLIC_REGISTRY_TITLE="Dev Registry" \
  npm run dev
```

Access the development server at `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start  # Runs the built server
```

### Project Structure

```
registry-ui/
├── scripts/
│   ├── migrate-db.mjs        # Database schema setup
│   ├── refresh-registry.mjs  # Registry sync script
│   └── db-schema.mjs         # SQLite schema definition
├── server/
│   ├── utils/db.ts           # Database connection singleton
│   └── api/                  # Nitro API routes
│       ├── repos.get.ts      # List all repositories
│       └── repos/[slug]/
│           ├── tags.get.ts   # Get repository images
│           └── tags/[digest].delete.ts  # Delete image
├── pages/
│   ├── index.vue             # Dashboard
│   └── repos/[slug].vue      # Repository detail
└── layouts/
    └── default.vue           # Shared layout
```

## How It Works

1. **Background Sync**: A cron job (or manual script) periodically fetches metadata from the Docker Registry API v2 and stores it in a local SQLite database
2. **API Layer**: Nuxt server API routes query the database and provide REST endpoints
3. **Frontend**: Vue 3 pages consume the API endpoints using `useFetch()` and display the data
4. **Deletion**: When you delete an image, the UI calls the registry's delete API, then triggers a refresh to update the database

The UI never directly modifies the registry data — it only reads from it and sends delete commands when requested.

## Technology Stack

- **Frontend**: Nuxt 4, Vue 3 (Composition API), Tailwind CSS 4
- **Backend**: Nitro (Nuxt server), better-sqlite3
- **Container**: Node.js 20 Alpine, Supercronic for scheduling
- **CI/CD**: GitHub Actions with multi-platform builds (amd64, arm64)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
