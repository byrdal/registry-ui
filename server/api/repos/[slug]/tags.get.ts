import { getDb } from "#server/utils/db";

export default defineEventHandler((event) => {
    const repoSlug = decodeURIComponent(getRouterParam(event, "slug") || "");
    if (!repoSlug) {
        throw createError({ statusCode: 400, statusMessage: "Missing repo slug" });
    }

    const db = getDb();
    
    // First, get the repo name from the slug
    const repoRow = db
        .prepare("SELECT name FROM repos WHERE slug = ?")
        .get(repoSlug);
    
    if (!repoRow) {
        throw createError({ statusCode: 404, statusMessage: "Repository not found" });
    }
    
    const repoName = repoRow.name;

    const rows = db
        .prepare(
            `
      SELECT tag, digest, media_type, size_bytes, last_seen_at, created_at, platform
      FROM tags
      WHERE repo_slug = ?
      ORDER BY created_at DESC
    `
        )
        .all(repoSlug) as any[];

    // Group tags that share the same digest into a single image entry.
    // Tags with a null digest cannot be merged, so each becomes its own entry.
    const imageMap = new Map<string, any>();
    const images: any[] = [];

    for (const row of rows) {
        if (row.digest && imageMap.has(row.digest)) {
            imageMap.get(row.digest).tags.push(row.tag);
        } else {
            const entry = {
                digest: row.digest,
                tags: [row.tag],
                media_type: row.media_type,
                size_bytes: row.size_bytes,
                platform: row.platform,
                created_at: row.created_at,
            };
            images.push(entry);
            if (row.digest) imageMap.set(row.digest, entry);
        }
    }

    return { repo: repoName, images };
});
