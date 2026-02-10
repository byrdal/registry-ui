import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

// ── Config ───────────────────────────────────────────────────────────

const REGISTRY_URL = process.env.REGISTRY_URL || "http://registry:5000";
const USERNAME = process.env.REGISTRY_USERNAME || "";
const PASSWORD = process.env.REGISTRY_PASSWORD || "";
const DB_PATH = process.env.DB_PATH || "/data/registry.db";

const MANIFEST_ACCEPT = [
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.oci.image.index.v1+json",
].join(", ");

const IMAGE_MANIFEST_TYPES = new Set([
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
]);

// ── HTTP helpers ─────────────────────────────────────────────────────

function authHeaders() {
    if (!USERNAME) return {};
    const token = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
    return { Authorization: `Basic ${token}` };
}

async function httpJson(url, extraHeaders = {}) {
    const res = await fetch(url, {
        headers: { ...authHeaders(), ...extraHeaders },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url} :: ${text}`);
    }
    return res.json();
}

async function httpHead(url, extraHeaders = {}) {
    const res = await fetch(url, {
        method: "HEAD",
        headers: { ...authHeaders(), ...extraHeaders },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} for HEAD ${url} :: ${text}`);
    }
    return res;
}

// ── Registry API ─────────────────────────────────────────────────────

function registryUrl(path) {
    return `${REGISTRY_URL}/v2/${path}`;
}

async function fetchRepos() {
    const data = await httpJson(registryUrl("_catalog"));
    return data.repositories || [];
}

async function fetchTags(repo) {
    const data = await httpJson(registryUrl(`${repo}/tags/list`));
    return data.tags || [];
}

// ── Manifest helpers ─────────────────────────────────────────────────

function isImageManifest(entry) {
    if (entry.platform) {
        const { os, architecture } = entry.platform;
        if (os === "unknown" || architecture === "unknown") return false;
    }
    if (entry.mediaType && !IMAGE_MANIFEST_TYPES.has(entry.mediaType)) return false;
    return true;
}

function formatPlatform({ os, architecture, variant }) {
    let s = `${os}/${architecture}`;
    if (variant) s += `/${variant}`;
    return s;
}

function sumLayers(layers) {
    return layers.reduce((sum, l) => sum + (l.size || 0), 0);
}

async function calcManifestListSize(repo, entries) {
    let total = 0;
    for (const entry of entries) {
        try {
            const m = await httpJson(
                registryUrl(`${repo}/manifests/${encodeURIComponent(entry.digest)}`),
                { Accept: MANIFEST_ACCEPT },
            );
            if (Array.isArray(m.layers)) total += sumLayers(m.layers);
            else if (m.size) total += m.size;
        } catch (e) {
            console.warn(`[refresh] failed to fetch platform manifest ${entry.digest} for ${repo}: ${e.message}`);
        }
    }
    return total;
}

async function fetchImageConfig(repo, configDigest) {
    const config = await httpJson(
        registryUrl(`${repo}/blobs/${configDigest}`),
        { Accept: "application/vnd.docker.container.image.v1+json" },
    );
    return {
        architecture: config.architecture || null,
        os: config.os || null,
        created: config.created || null,
    };
}

async function fetchManifest(repo, tag) {
    const ref = encodeURIComponent(tag);

    const head = await httpHead(
        registryUrl(`${repo}/manifests/${ref}`),
        { Accept: MANIFEST_ACCEPT },
    );
    const digest = head.headers.get("docker-content-digest") || null;

    const manifest = await httpJson(
        registryUrl(`${repo}/manifests/${ref}`),
        { Accept: MANIFEST_ACCEPT },
    );
    const mediaType = manifest.mediaType || null;

    const imageEntries = Array.isArray(manifest.manifests)
        ? manifest.manifests.filter(isImageManifest)
        : null;

    // ── Size
    let sizeBytes = null;
    if (Array.isArray(manifest.layers)) {
        sizeBytes = sumLayers(manifest.layers);
    } else if (imageEntries) {
        sizeBytes = await calcManifestListSize(repo, imageEntries);
    }

    // ── Platform
    let platform = null;
    let architecture = null;
    let os = null;

    if (manifest.platform) {
        platform = formatPlatform(manifest.platform);
        ({ architecture, os } = manifest.platform);
    } else if (imageEntries) {
        const platforms = imageEntries
            .filter(e => e.platform)
            .map(e => formatPlatform(e.platform));
        if (platforms.length) platform = platforms.join(", ");
    }

    // ── Created timestamp & config-blob platform refinement
    let created = null;
    let configDigest = manifest.config?.digest || null;

    // For manifest lists, resolve config digest from the first platform manifest
    if (!configDigest && imageEntries?.length) {
        try {
            const first = await httpJson(
                registryUrl(`${repo}/manifests/${encodeURIComponent(imageEntries[0].digest)}`),
                { Accept: MANIFEST_ACCEPT },
            );
            configDigest = first.config?.digest || null;
        } catch (e) {
            console.warn(`[refresh] failed to fetch platform manifest for config of ${repo}:${tag}: ${e.message}`);
        }
    }

    if (configDigest) {
        try {
            const cfg = await fetchImageConfig(repo, configDigest);
            created = cfg.created;
            if (cfg.architecture && cfg.os) {
                ({ architecture, os } = cfg);
                if (!platform) platform = `${cfg.os}/${cfg.architecture}`;
            }
        } catch (e) {
            console.warn(`[refresh] failed to fetch config blob for ${repo}:${tag}: ${e.message}`);
        }
    }

    return { digest, mediaType, sizeBytes, platform, architecture, os, created };
}

// ── Database ─────────────────────────────────────────────────────────

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function openDb() {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    return db;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
    const db = openDb();
    const ts = new Date().toISOString();

    console.log(`[refresh] registry=${REGISTRY_URL} db=${DB_PATH} at ${ts}`);

    const repos = await fetchRepos();
    console.log(`[refresh] repos=${repos.length}`);

    const upsertRepo = db.prepare(`
        INSERT INTO repos (name, slug, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET updated_at=excluded.updated_at
    `);

    const upsertTag = db.prepare(`
        INSERT INTO tags (repo_slug, tag, digest, media_type, size_bytes, created_at, last_seen_at, platform)
        VALUES (?, ?, ?, ?, ?, COALESCE(?, ?), ?, ?)
        ON CONFLICT(repo_slug, tag) DO UPDATE SET
            digest=excluded.digest,
            media_type=excluded.media_type,
            size_bytes=excluded.size_bytes,
            created_at=COALESCE(excluded.created_at, tags.created_at),
            last_seen_at=excluded.last_seen_at,
            platform=excluded.platform
    `);

    for (const repo of repos) {
        const slug = slugify(repo);
        upsertRepo.run(repo, slug, ts);

        let tags = [];
        try {
            tags = await fetchTags(repo);
        } catch (e) {
            console.warn(`[refresh] failed tags for ${repo}: ${e.message}`);
            continue;
        }

        for (const tag of tags) {
            try {
                const { digest, mediaType, sizeBytes, platform, created } = await fetchManifest(repo, tag);
                upsertTag.run(slug, tag, digest, mediaType, sizeBytes, created, ts, ts, platform);
            } catch (e) {
                console.warn(`[refresh] failed manifest for ${repo}:${tag}: ${e.message}`);
                upsertTag.run(slug, tag, null, null, null, null, ts, ts, null);
            }
        }
    }

    // Prune stale entries: delete repos and tags that weren't seen in this sync
    const deletedTags = db.prepare("DELETE FROM tags WHERE last_seen_at < ?").run(ts);
    const deletedRepos = db.prepare("DELETE FROM repos WHERE updated_at < ?").run(ts);

    console.log(`[refresh] pruned ${deletedTags.changes} stale tags, ${deletedRepos.changes} stale repos`);
    console.log("[refresh] done");
}

main().catch((e) => {
    console.error("[refresh] fatal:", e);
    process.exit(1);
});
