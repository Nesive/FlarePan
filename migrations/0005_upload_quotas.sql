-- Upload quotas + expiry ledger (see utils/upload-limits.ts).
--
-- The ledger counts only files uploaded through the gated routes AFTER
-- this migration; older files are not counted (fail-open for totals,
-- so an upgrade never locks out an existing library). Reservations
-- cover multipart uploads between create and complete; a reservation
-- only affects the daily sum of its own calendar day, so an abandoned
-- upload stops counting tomorrow without any cleanup.
CREATE TABLE IF NOT EXISTS upload_ledger (
  key TEXT PRIMARY KEY,
  size INTEGER NOT NULL,
  identity TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_upload_ledger_identity_day
  ON upload_ledger(identity, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_upload_ledger_expires
  ON upload_ledger(expires_at);
CREATE TABLE IF NOT EXISTS upload_reservations (
  upload_id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  identity TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_upload_reservations_identity
  ON upload_reservations(identity, created_at);
