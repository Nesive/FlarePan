-- Short-link mappings for shares: which Sink short codes were created
-- for each share's /s/<slug> URL, so revoking a share can delete them
-- from Sink. Applied after 0002_add_shares.sql. No foreign keys (same
-- rule as 0001: orphan rows must stay possible so a deleted share
-- never breaks the table). short_code is the Sink slug sent in the
-- upsert request (the deterministic slug from shorten.ts), which is
-- also the key Sink's delete endpoint takes. created_at is Unix seconds.
CREATE TABLE IF NOT EXISTS share_shortlinks (
  short_code TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS share_shortlinks_slug_idx ON share_shortlinks (slug);
