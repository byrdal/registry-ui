import { getDb } from "../utils/db";

export default defineEventHandler((event) => {
    const db = getDb();

    // Get pagination parameters from query
    const query = getQuery(event);
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
    const search = (query.search as string || "").trim().toLowerCase();
    const offset = (page - 1) * limit;

    // Get total count of repositories (with optional search filter)
    let totalCount: number;
    if (search) {
        const result = db
            .prepare("SELECT COUNT(*) as count FROM repos WHERE LOWER(name) LIKE ?")
            .get(`%${search}%`) as { count: number } | undefined;
        totalCount = result?.count || 0;
    } else {
        const result = db
            .prepare("SELECT COUNT(*) as count FROM repos")
            .get() as { count: number } | undefined;
        totalCount = result?.count || 0;
    }

    // Query to get paginated repos with their total size (deduplicated by digest)
    let rowsQuery = `
        SELECT
            r.name,
            r.slug,
            r.updated_at,
            t.tag,
            t.created_at,
            t.digest,
            t.size_bytes
        FROM repos r
        LEFT JOIN tags t ON r.slug = t.repo_slug
    `;

    if (search) {
        rowsQuery += ` WHERE LOWER(r.name) LIKE ?`;
    }

    rowsQuery += ` ORDER BY r.name ASC, t.created_at DESC`;

    const rows = search
        ? db.prepare(rowsQuery).all(`%${search}%`)
        : db.prepare(rowsQuery).all();

    // Group the results by repo name, deduplicating size by digest
    const repos: any = {};
    rows.forEach((row: any) => {
        const repoName = row.name;
        if (!repos[repoName]) {
            repos[repoName] = {
                name: repoName,
                slug: row.slug,
                updated_at: row.updated_at,
                tags: [],
                size_bytes: 0,
                last_tag_created_at: null,
                seenDigests: new Set()
            };
        }

        // Add tag data if it exists
        if (row.tag) {
            repos[repoName].tags.push(row.tag);
        }

        // Track the most recent tag creation time (rows are ordered by created_at DESC)
        if (row.created_at && !repos[repoName].last_tag_created_at) {
            repos[repoName].last_tag_created_at = row.created_at;
        }

        // Add size only once per unique digest to avoid double-counting
        if (row.digest && row.size_bytes && !repos[repoName].seenDigests.has(row.digest)) {
            repos[repoName].size_bytes += row.size_bytes;
            repos[repoName].seenDigests.add(row.digest);
        }
    });

    // Convert object to array and clean up internal tracking
    const allRepos = Object.values(repos).map((repo: any) => {
        const { seenDigests, ...cleanRepo } = repo;
        return cleanRepo;
    });

    // Apply pagination to the grouped results
    const paginatedRepos = allRepos.slice(offset, offset + limit);
    const totalPages = Math.ceil(totalCount / limit);

    return {
        repos: paginatedRepos,
        pagination: {
            page,
            limit,
            total: totalCount,
            totalPages
        }
    };
});
