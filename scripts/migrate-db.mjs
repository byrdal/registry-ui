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
    
    // Every statement is IF NOT EXISTS, so this also adds new tables to existing databases
    db.exec(schemaSql);
    console.log("[migrate] schema up to date");
    
    db.close();
}

main().catch((e) => {
    console.error("[migrate] fatal:", e);
    process.exit(1);
});
