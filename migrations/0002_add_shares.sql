-- Share links for protected folders (extraction-code shares).
-- Applied after 0001_init.sql. No foreign keys (same rule as 0001:
-- orphan rows must stay possible so a deleted folder never breaks
-- the table). The extraction code itself is NEVER stored: only its
-- SHA-256 hex digest (code_hash). created_at / expires_at /
-- locked_until are Unix seconds; expires_at NULL means permanent.
CREATE TABLE IF NOT EXISTS shares (
  slug TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
