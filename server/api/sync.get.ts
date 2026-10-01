import { getDb } from "../utils/db";

export default defineEventHandler(() => {
    const row = getDb()
        .prepare("SELECT value FROM meta WHERE key = 'last_sync_at'")
        .get() as { value: string } | undefined;

    return { lastSyncAt: row?.value || null };
});
