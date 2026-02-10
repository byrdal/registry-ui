import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { schemaSql } from "./db-schema.mjs";
import {dirname} from "node:path";

const DB_PATH = process.env.DB_PATH || "/data/registry.db";

function openDb() {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    return db;
}

async function main() {
    console.log(`[migrate] db=${DB_PATH}`);
    
    const db = openDb();
    
    // Check if the schema already exists by looking for tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    if (tables.length === 0) {
        console.log("[migrate] creating schema...");
        db.exec(schemaSql);
        console.log("[migrate] schema created successfully");
    } else {
        console.log("[migrate] schema already exists, skipping");
    }
    
    db.close();
}

main().catch((e) => {
    console.error("[migrate] fatal:", e);
    process.exit(1);
});
