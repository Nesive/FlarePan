-- Pan configuration tables (D1). Applied to the preview database "pan"
-- (uuid 005540fd-aadc-4f94-a735-c7dcaa6ceebb) on 2026-11-02.
-- Replaces the four R2 JSON objects (_$flaredrive$/accounts.json,
-- permissions.json, read-protection.json, dav-settings.json).
-- No JSON blobs: every field is a typed column. No foreign keys: the
-- old JSON code allowed orphan permission rules, and adding FKs would
-- reject previously-valid states. R2 still holds files only; env
-- secrets (READ_ADMIN_*, SESSION_SECRET) stay in Pages secrets.
CREATE TABLE IF NOT EXISTS accounts (
  user TEXT PRIMARY KEY,
  pass_hash TEXT NOT NULL CHECK (length(pass_hash) = 64),
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  dav_enabled INTEGER NOT NULL DEFAULT 0 CHECK (dav_enabled IN (0, 1))
);
CREATE TABLE IF NOT EXISTS permission_rules (
  user TEXT NOT NULL,
  prefix TEXT NOT NULL,
  access TEXT NOT NULL CHECK (access IN ('read', 'write', 'none')),
  PRIMARY KEY (user, prefix)
);
CREATE TABLE IF NOT EXISTS protected_prefixes (
  prefix TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
