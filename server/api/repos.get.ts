import { getDb } from "../utils/db";

export default defineEventHandler(() => {
    const db = getDb();

    // Query to get all repos with their total size (deduplicated by digest)
    const rows = db
        .prepare(`
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
            ORDER BY r.name ASC, t.created_at DESC
        `)
        .all();

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
    const reposList = Object.values(repos).map((repo: any) => {
        const { seenDigests, ...cleanRepo } = repo;
        return cleanRepo;
    });

    return { repos: reposList };
});
