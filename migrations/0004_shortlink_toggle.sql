-- Short-link master switch. Stored in the settings table alongside the
-- Sink service config (see getShortenSettings/putShortenSettings).
--
-- Default ON preserves existing behavior for deployments that upgrade
-- (their short-link buttons keep working). A fresh deployment that does
-- not use short links should turn it off in the admin short-link tab:
-- when off, the frontend hides every short-link control, the admin
-- short-link config section hides, and POST /api/shorten refuses with
-- shortlink_disabled. The switch itself always stays visible so it can
-- be turned back on.
INSERT INTO settings (key, value) VALUES ('shortlink_enabled', '1')
ON CONFLICT(key) DO NOTHING;
