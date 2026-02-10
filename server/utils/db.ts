import Database from "better-sqlite3";
import { useRuntimeConfig } from "#imports";

let db: Database.Database | null = null;

export function getDb() {
    if (db) return db;

    const cfg = useRuntimeConfig();
    db = new Database(cfg.dbPath);

    db.pragma("journal_mode = WAL");

    return db;
}
