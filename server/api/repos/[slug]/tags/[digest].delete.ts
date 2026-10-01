import { getDb } from "#server/utils/db";

export default defineEventHandler(async (event) => {
    const repoSlug = decodeURIComponent(getRouterParam(event, "slug") || "");
    const digest = decodeURIComponent(getRouterParam(event, "digest") || "");

    if (!repoSlug || !digest) {
        throw createError({
            statusCode: 400,
            statusMessage: "Missing repo slug or digest"
        });
    }

    const db = getDb();

    // Get the actual repo name from the slug
    const repoRow = db
        .prepare("SELECT name FROM repos WHERE slug = ?")
        .get(repoSlug) as any;

    if (!repoRow) {
        throw createError({
            statusCode: 404,
            statusMessage: "Repository not found"
        });
    }

    const repoName = repoRow.name;

    const {
        registryUrl,
        registryUsername: username,
        registryPassword: password
    } = useRuntimeConfig(event);

    // Build auth headers if credentials are provided
    const headers: Record<string, string> = {};
    if (username) {
        const token = Buffer.from(`${username}:${password}`).toString("base64");
        headers.Authorization = `Basic ${token}`;
    }

    // Call the registry API to delete the manifest by digest
    const deleteUrl = `${registryUrl}/v2/${repoName}/manifests/${digest}`;

    try {
        const response = await fetch(deleteUrl, {
            method: "DELETE",
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");

            // Handle common error cases
            if (response.status === 405) {
                throw createError({
                    statusCode: 405,
                    statusMessage: "Delete not supported. Registry may have REGISTRY_STORAGE_DELETE_ENABLED=false"
                });
            }

            throw createError({
                statusCode: response.status,
                statusMessage: `Registry deletion failed: ${response.statusText}. ${errorText}`
            });
        }

        // Successful deletion (202 Accepted): drop the tags pointing at this digest
        db.prepare("DELETE FROM tags WHERE repo_slug = ? AND digest = ?").run(repoSlug, digest);

        return {
            success: true,
            message: "Manifest deleted successfully",
            digest
        };

    } catch (error: any) {
        // Re-throw createError errors
        if (error.statusCode) {
            throw error;
        }

        // Handle network/fetch errors
        throw createError({
            statusCode: 502,
            statusMessage: `Failed to connect to registry: ${error.message}`
        });
    }
});
