import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { schemaSql } from "./db-schema.mjs";

const DB_PATH = process.env.DB_PATH || "/data/registry.db";

function openDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function randomDigest() {
  return "sha256:" + randomBytes(32).toString("hex");
}

function randomSize(minMB, maxMB) {
  return Math.floor((minMB + Math.random() * (maxMB - minMB)) * 1024 * 1024);
}

function randomDate(daysBack = 120) {
  const now = Date.now();
  const offset = Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - offset).toISOString();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Seed data definitions ───────────────────────────────────────────

const REPOS = [
  "nginx",
  "postgres",
  "redis",
  "node",
  "python",
  "grafana/grafana",
  "traefik",
  "minio/minio",
  "keycloak/keycloak",
  "registry-ui",
  "api-gateway",
  "auth-service",
  "frontend-app",
  "worker",
  "caddy",
];

const SEMVER_TAGS = [
  "1.0.0", "1.0.1", "1.1.0", "1.2.0", "1.2.3",
  "2.0.0", "2.1.0", "2.1.1", "2.2.0",
  "3.0.0", "3.1.0", "3.2.1",
];

const EXTRA_TAGS = ["latest", "stable", "edge", "alpine", "slim", "bookworm"];

const PLATFORMS = [
  "linux/amd64",
  "linux/arm64",
  "linux/amd64, linux/arm64",
  "linux/amd64, linux/arm64, linux/arm/v7",
];

const MEDIA_TYPES = [
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.oci.image.index.v1+json",
];

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const db = openDb();
  db.exec(schemaSql);

  const ts = new Date().toISOString();

  const upsertRepo = db.prepare(`
    INSERT INTO repos (name, slug, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET updated_at=excluded.updated_at
  `);

  const upsertTag = db.prepare(`
    INSERT INTO tags (repo_slug, tag, digest, media_type, size_bytes, created_at, last_seen_at, platform)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo_slug, tag) DO UPDATE SET
      digest=excluded.digest,
      media_type=excluded.media_type,
      size_bytes=excluded.size_bytes,
      created_at=excluded.created_at,
      last_seen_at=excluded.last_seen_at,
      platform=excluded.platform
  `);

  let totalTags = 0;

  const insertAll = db.transaction(() => {
    for (const repo of REPOS) {
      const slug = slugify(repo);
      upsertRepo.run(repo, slug, ts);

      // Pick a random subset of semver tags
      const numSemver = 2 + Math.floor(Math.random() * 6);
      const shuffled = [...SEMVER_TAGS].sort(() => Math.random() - 0.5);
      const tags = shuffled.slice(0, numSemver);

      // Add some extra tags
      const numExtra = 1 + Math.floor(Math.random() * 3);
      const extraShuffled = [...EXTRA_TAGS].sort(() => Math.random() - 0.5);
      tags.push(...extraShuffled.slice(0, numExtra));

      // Group some tags under the same digest (simulating tag aliasing)
      const digests = [];
      const numDigests = Math.max(1, tags.length - Math.floor(Math.random() * 3));
      for (let i = 0; i < numDigests; i++) {
        digests.push({
          digest: randomDigest(),
          size: randomSize(20, 800),
          platform: pick(PLATFORMS),
          mediaType: pick(MEDIA_TYPES),
          created: randomDate(),
        });
      }

      for (const tag of tags) {
        const d = pick(digests);
        upsertTag.run(slug, tag, d.digest, d.mediaType, d.size, d.created, ts, d.platform);
        totalTags++;
      }
    }
  });

  insertAll();

  console.log(`[seed] inserted ${REPOS.length} repos, ${totalTags} tags into ${DB_PATH}`);
  db.close();
}

main();
