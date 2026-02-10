import { getDb } from "#server/utils/db";

export default defineEventHandler((event) => {
    const repoSlug = decodeURIComponent(getRouterParam(event, "slug") || "");
    if (!repoSlug) {
        throw createError({ statusCode: 400, statusMessage: "Missing repo slug" });
    }

    const db = getDb();

    // Get pagination parameters from query
    const query = getQuery(event);
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 50));
    const search = (query.search as string || "").trim().toLowerCase();
    const offset = (page - 1) * limit;

    // First, get the repo name from the slug
    const repoRow = db
        .prepare("SELECT name FROM repos WHERE slug = ?")
        .get(repoSlug) as { name: string } | undefined;

    if (!repoRow) {
        throw createError({ statusCode: 404, statusMessage: "Repository not found" });
    }

    const repoName = repoRow.name;

    // Get all tags for grouping (we need to group by digest first, then paginate)
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
    const allImages: any[] = [];

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
            allImages.push(entry);
            if (row.digest) imageMap.set(row.digest, entry);
        }
    }

    // Apply search filter if provided
    let filteredImages = allImages;
    if (search) {
        filteredImages = allImages.filter((img) =>
            img.tags.some((tag: string) => tag.toLowerCase().includes(search))
        );
    }

    // Apply pagination to the grouped and filtered results
    const totalCount = filteredImages.length;
    const paginatedImages = filteredImages.slice(offset, offset + limit);
    const totalPages = Math.ceil(totalCount / limit);

    return {
        repo: repoName,
        images: paginatedImages,
        pagination: {
            page,
            limit,
            total: totalCount,
            totalPages
        }
    };
});
