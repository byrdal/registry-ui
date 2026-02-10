export const schemaSql = `
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_slug TEXT NOT NULL,
  tag TEXT NOT NULL,
  digest TEXT,
  media_type TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  platform TEXT,
  UNIQUE(repo_slug, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_repo ON tags(repo_slug);
`;