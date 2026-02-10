import { getDb } from "#server/utils/db";
import { execSync } from "node:child_process";

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

    // Get registry configuration from environment
    const registryUrl = process.env.REGISTRY_URL || "http://registry:5000";
    const username = process.env.REGISTRY_USERNAME || "";
    const password = process.env.REGISTRY_PASSWORD || "";

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

        // Successful deletion (202 Accepted)
        // Now refresh the database to remove the deleted entries
        const dbPath = process.env.DB_PATH || "/data/registry.db";

        try {
            // Run the refresh script to sync the database
            execSync(
                `DB_PATH="${dbPath}" REGISTRY_URL="${registryUrl}" REGISTRY_USERNAME="${username}" REGISTRY_PASSWORD="${password}" node scripts/refresh-registry.mjs`,
                {
                    cwd: process.cwd(),
                    stdio: 'pipe'
                }
            );
        } catch (refreshError: any) {
            console.error("Database refresh failed after deletion:", refreshError.message);
            // Don't fail the request - deletion succeeded, just log the refresh error
        }

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
