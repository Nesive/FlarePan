// Read-side folder protection + multi-account auth for FlareDrive-R2.
//
// Credential sources, in resolution order for one username:
//   1. The accounts table in D1 (see below) — only `enabled` rows count.
//   2. The legacy single admin from Pages secrets (fallback):
//        READ_ADMIN_USER  (default "admin" when unset)
//        READ_ADMIN_PASS_HASH (lowercase hex SHA-256 of the password)
//      No password, plaintext or hashed, ever lives in the repo.
//
// D1 configuration tables (DB binding; R2 holds files only):
//   accounts (user TEXT PRIMARY KEY, pass_hash TEXT (lowercase hex
//     sha256), role 'admin' | 'user', enabled 0/1, dav_enabled 0/1)
//   permission_rules (user, prefix, access 'read' | 'write' | 'none';
//     PRIMARY KEY (user, prefix))
//   protected_prefixes (prefix TEXT PRIMARY KEY)
//   settings (key TEXT PRIMARY KEY, value TEXT; key 'dav_enabled'
//     holds 'true' | 'false'; keys 'sink_base_url' / 'sink_site_token'
//     hold the admin-managed short-link configuration, see
//     getShortenSettings below)
//   shares (slug TEXT PRIMARY KEY, prefix, code_hash (SHA-256 hex
//     only, never the code itself), created_by, created_at,
//     expires_at NULL=permanent, enabled, failed_attempts,
//     locked_until; see migrations/0002_add_shares.sql)
// Full schema: migrations/0001_init.sql + 0002_add_shares.sql. Env secrets
// (READ_ADMIN_*,
// SESSION_SECRET) stay in Pages secrets and are never stored in D1.
//
// Fail-closed rules:
//   - Missing DB binding, or a failed D1 query, is treated like a
//     corrupt config: protection reads fail closed (500), accounts
//     are unusable (only the legacy env admin can authenticate),
//     permissions read as empty (non-admins see no protected path,
//     admins unaffected), DAV settings treated as enabled=true.
//     (Entry-level bad rows are dropped; a dropped row can never
//     authenticate because its hash cannot match, so dropping is
//     fail-closed for that row.)
//   - A DAV settings value other than 'true' | 'false' -> treated as
//     enabled=true, and the dav-settings management endpoint reports
//     corrupted=true (same reporting shape as the protection endpoint).
//
// Sessions: the existing fd_read_session cookie (HMAC over the username
// + expiry, SESSION_SECRET, 7-day TTL) is unchanged. The cookie carries
// only the username; role / davEnabled are re-resolved from the
// accounts table (or the env admin) on every verification, so admin
// edits take effect without re-login.
//
// Management endpoints accept ONLY cookie sessions, never Basic Auth,
// so a DAV client cannot rewrite configuration. Admin endpoints
// answer 401 when unauthenticated and 403 when authenticated but not
// an admin.

const COOKIE_NAME = 'fd_read_session';
const SESSION_TTL_SECONDS = 7 * 24 * 3600;
const MAX_PROTECTED_ENTRIES = 100;
const MAX_PREFIX_LENGTH = 200;
export const USERNAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;

function normalizePrefix(prefix) {
  if (typeof prefix !== 'string') return '';
  let p = prefix.replace(/^\/+/, '');
  if (!p) return '';
  if (!p.endsWith('/')) p += '/';
  return p;
}

function prefixMatches(path, prefix) {
  // path has no leading slash; prefix always ends with "/".
  if (!prefix) return false;
  return path === prefix.slice(0, -1) || path.startsWith(prefix);
}

// Validates one prefix with the same rules as the protected list:
// non-empty after normalization, no _$flaredrive$/ prefix, no "." / ".."
// segments, length cap. Returns the normalized prefix or null.
export function validatePrefix(prefix) {
  if (typeof prefix !== 'string' || prefix.length > MAX_PREFIX_LENGTH) {
    return null;
  }
  const cleaned = normalizePrefix(prefix);
  if (!cleaned) return null;
  if (cleaned.startsWith('_$flaredrive$/')) return null;
  const segments = cleaned.split('/').filter((s) => s !== '');
  if (segments.some((s) => s === '.' || s === '..')) return null;
  return cleaned;
}

// Validates a user-supplied path (folder or key, no leading slash) with
// the same segment rules. Returns the cleaned path or null. An empty
// string is allowed only when allowEmpty is set (root folder).
export function validateUserPath(path, allowEmpty) {
  if (typeof path !== 'string') return null;
  let p = path.replace(/^\/+/, '');
  if (!p) return allowEmpty ? '' : null;
  if (p.startsWith('_$flaredrive$/')) return null;
  const segments = p.split('/').filter((s) => s !== '');
  if (segments.length === 0) return allowEmpty ? '' : null;
  if (segments.some((s) => s === '.' || s === '..')) return null;
  return segments.join('/');
}

// The single legacy admin account, from Pages secrets only.
export function getAdminAccount(env) {
  const user = env['READ_ADMIN_USER'] || 'admin';
  const passHash = (env['READ_ADMIN_PASS_HASH'] || '').toLowerCase();
  if (!passHash) return null;
  return { user, passHash };
}

// Reads the protected list from D1. Empty table = no protection yet.
// A missing binding or a failed query = fail closed (callers answer
// 500 rather than leaking folders whose protection state is unknown);
// the management API can still overwrite it once the binding exists.
export async function getProtectionConfig(db) {
  if (!db) return { protected: [], corrupted: true };
  try {
    const res = await db
      .prepare('SELECT prefix FROM protected_prefixes ORDER BY prefix')
      .all();
    if (!res.success) return { protected: [], corrupted: true };
    const cleaned = [];
    for (const row of res.results || []) {
      const prefix = validatePrefix(row.prefix);
      if (prefix && !cleaned.includes(prefix)) cleaned.push(prefix);
    }
    return { protected: cleaned, corrupted: false };
  } catch {
    return { protected: [], corrupted: true };
  }
}

// Replaces the protected list in D1 (single batch = atomic). Callers
// pass a list already cleaned by validateProtectionList.
export async function putProtectionConfig(db, list) {
  if (!db) throw new Error('no_db');
  const stmts = [db.prepare('DELETE FROM protected_prefixes')];
  for (const prefix of list) {
    stmts.push(
      db
      .prepare('INSERT INTO protected_prefixes (prefix) VALUES (?)')
      .bind(prefix)
    );
  }
  await db.batch(stmts);
}

// Validates a protection list submitted by the admin UI. Returns the
// cleaned list, or null when invalid.
export function validateProtectionList(list) {
  if (!Array.isArray(list) || list.length > MAX_PROTECTED_ENTRIES) return null;
  const cleaned = [];
  for (const entry of list) {
    const prefix = validatePrefix(entry);
    if (prefix === null) return null;
    if (!cleaned.includes(prefix)) cleaned.push(prefix);
  }
  cleaned.sort();
  return cleaned;
}

export function isProtectedPath(path, protectedList) {
  const p = (path || '').replace(/^\/+/, '');
  if (!p) return false;
  return (protectedList || []).some((prefix) => prefixMatches(p, prefix));
}

function cleanAccountRow(row) {
  if (!row || typeof row.user !== 'string' || !USERNAME_RE.test(row.user)) {
    return null;
  }
  const passHash = typeof row.passHash === 'string'
    ? row.passHash.toLowerCase()
    : '';
  if (!/^[0-9a-f]{64}$/.test(passHash)) return null;
  return {
    user: row.user,
    passHash,
    role: row.role === 'admin' ? 'admin' : 'user',
    enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
    davEnabled: typeof row.davEnabled === 'boolean' ? row.davEnabled : false,
  };
}

// Reads the accounts table. Empty table = no library yet (the env
// admin fallback applies). A missing binding or a failed query =
// corrupted:true with an empty user list, so no table account can
// authenticate (the env admin fallback still applies).
export async function getAccountsConfig(db) {
  if (!db) return { users: [], corrupted: true, present: false };
  try {
    const res = await db
      .prepare(
        'SELECT user, pass_hash, role, enabled, dav_enabled FROM accounts ORDER BY user'
      )
      .all();
    if (!res.success) return { users: [], corrupted: true, present: true };
    const users = [];
    for (const row of res.results || []) {
      const cleaned = cleanAccountRow({
        user: row.user,
        passHash: row.pass_hash,
        role: row.role,
        enabled: !!row.enabled,
        davEnabled: !!row.dav_enabled,
      });
      if (cleaned && !users.some((u) => u.user === cleaned.user)) {
        users.push(cleaned);
      }
    }
    return { users, corrupted: false, present: true };
  } catch {
    return { users: [], corrupted: true, present: true };
  }
}

// Replaces the accounts table in D1 (single batch = atomic). Callers
// pass rows already cleaned (see cleanAccountRow) or freshly hashed.
export async function putAccountsConfig(db, users) {
  if (!db) throw new Error('no_db');
  const stmts = [db.prepare('DELETE FROM accounts')];
  for (const u of users) {
    stmts.push(
      db.prepare(
        'INSERT INTO accounts (user, pass_hash, role, enabled, dav_enabled) VALUES (?, ?, ?, ?, ?)'
      ).bind(u.user,
      u.passHash,
      u.role,
      u.enabled ? 1 : 0,
      u.davEnabled ? 1 : 0)
    );
  }
  await db.batch(stmts);
}

// Public view of an account row: never includes the password hash.
export function publicAccountUser(row) {
  return {
    user: row.user,
    role: row.role,
    enabled: row.enabled,
    davEnabled: row.davEnabled,
  };
}

export function countEnabledAdmins(users) {
  return users.filter((u) => u.role === 'admin' && u.enabled).length;
}

function cleanPermissionRule(row) {
  if (!row || typeof row.user !== 'string' || !USERNAME_RE.test(row.user)) {
    return null;
  }
  const prefix = validatePrefix(row.prefix);
  if (prefix === null) return null;
  if (row.access !== 'read'
  && row.access !== 'write'
  && row.access !== 'none') {
    return null;
  }
  return { user: row.user, prefix, access: row.access };
}

// Reads the permission rules. Empty table = no rules. A missing
// binding or a failed query = corrupted:true with empty rules (fail
// closed for non-admins on protected paths; admins unaffected).
export async function getPermissionsConfig(db) {
  if (!db) return { rules: [], corrupted: true };
  try {
    const res = await db
      .prepare('SELECT user, prefix, access FROM permission_rules ORDER BY user, prefix')
      .all();
    if (!res.success) return { rules: [], corrupted: true };
    const rules = [];
    for (const row of res.results || []) {
      const cleaned = cleanPermissionRule(row);
      if (
        cleaned &&
        !rules
        .some((r) => r.user === cleaned.user && r.prefix === cleaned.prefix)
      ) {
        rules.push(cleaned);
      }
    }
    return { rules, corrupted: false };
  } catch {
    return { rules: [], corrupted: true };
  }
}

// Replaces the permission rules in D1 (single batch = atomic). Callers
// pass rules already cleaned (see cleanPermissionRule).
export async function putPermissionsConfig(db, rules) {
  if (!db) throw new Error('no_db');
  const stmts = [db.prepare('DELETE FROM permission_rules')];
  for (const r of rules) {
    stmts.push(
      db.prepare(
        'INSERT INTO permission_rules (user, prefix, access) VALUES (?, ?, ?)'
      ).bind(r.user, r.prefix, r.access)
    );
  }
  await db.batch(stmts);
}

// Reads the DAV on/off switch. No row = enabled. A value other than
// 'true' | 'false' = treated as enabled, with corrupted:true reported
// so the management endpoint can surface (and repair) it. A missing
// binding or a failed query = enabled:true with corrupted:true.
export async function getDavSettings(db) {
  if (!db) return { enabled: true, corrupted: true };
  try {
    const row = await db
      .prepare('SELECT value FROM settings WHERE key = \'dav_enabled\'')
      .first();
    if (!row) return { enabled: true, corrupted: false };
    if (row.value === 'true') return { enabled: true, corrupted: false };
    if (row.value === 'false') return { enabled: false, corrupted: false };
    return { enabled: true, corrupted: true };
  } catch {
    return { enabled: true, corrupted: true };
  }
}

export async function putDavSettings(db, enabled) {
  if (!db) throw new Error('no_db');
  await db
    .prepare(
      'INSERT INTO settings (key, value) VALUES (\'dav_enabled\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .bind(enabled ? 'true' : 'false')
    .run();
}

// Short-link service configuration (admin-managed, D1 settings table).
// No migration needed: the settings table already holds arbitrary
// key/value rows. Validation mirrors the shorten proxy's own rules: a
// base URL must be https, except loopback http (127.0.0.1/localhost)
// which exists only so the proxy can be verified against a local mock
// Sink; a token must be non-empty and whitespace-free after trimming
// (Sink itself only hash-compares the token and enforces no length,
// so this helper must not be stricter than Sink). A stored value that
// fails validation is reported as corrupted and treated as
// unconfigured, never used.
export function isValidShortenBaseUrl(value) {
  if (typeof value !== 'string'
  || value === ''
  || /\s/.test(value)) return false;
  try {
    const u = new URL(value);
    if (u.protocol === 'https:' && u.hostname) return true;
    if (
      u.protocol === 'http:' &&
      (u.hostname === '127.0.0.1' || u.hostname === 'localhost')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isValidShortenToken(value) {
  // Sink's own rule is the authority: its auth middleware only
  // SHA-256-compares the token and enforces no length at all (the
  // "at least 8 characters" figure is docs advice for choosing a
  // secret, not a server-side rule). So this helper only requires
  // a non-empty, whitespace-free value after trimming; pasted
  // leading/trailing whitespace is stripped by callers before
  // storing, never rejected.
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed !== '' && /^\S+$/.test(trimmed);
}

// Reads the admin short-link settings. No rows = unconfigured (not
// corrupted). A missing binding or a failed query = corrupted:true
// with empty values, so callers fall back to env config or report
// unconfigured rather than using unknown values. The returned token
// is for server-side use only; management endpoints must never
// serialize it (they return hasToken instead).
export async function getShortenSettings(db) {
  if (!db) {
    return { baseUrl: '',
    token: '',
    hasToken: false,
    configured: false,
    corrupted: true, enabled: true };
  }
  try {
    const res = await db
      .prepare(
        'SELECT key, value FROM settings WHERE key IN (\'sink_base_url\', \'sink_site_token\', \'shortlink_enabled\')'
      )
      .all();
    if (!res.success) {
      return { baseUrl: '',
      token: '',
      hasToken: false,
      configured: false,
      corrupted: true, enabled: true };
    }
    let baseUrl = '';
    let token = '';
    // The master switch defaults to enabled: only an exact '0' turns
    // short links off (older deployments have no such row at all).
    let enabled = true;
    for (const row of res.results || []) {
      if (row.key === 'sink_base_url'
        && typeof row.value === 'string') baseUrl = row
      .value;
      if (row.key === 'sink_site_token'
        && typeof row.value === 'string') token = row
      .value;
      if (row.key === 'shortlink_enabled'
        && typeof row.value === 'string') enabled = row.value !== '0';
    }
    const baseOk = baseUrl === '' || isValidShortenBaseUrl(baseUrl);
    const tokenOk = token === '' || isValidShortenToken(token);
    const corrupted = !baseOk || !tokenOk;
    const configured = !corrupted && baseUrl !== '' && token !== '';
    return { baseUrl,
    token,
    hasToken: tokenOk && token !== '',
    configured,
    corrupted,
    enabled };
  } catch {
    return { baseUrl: '',
    token: '',
    hasToken: false,
    configured: false,
    corrupted: true, enabled: true };
  }
}

// Partial update: undefined = preserve; "" for baseUrl = clear that
// row; a non-empty token overwrites. Callers validate before calling
// (the management endpoint validates baseUrl/token and never passes
// an empty token, which per spec preserves the stored token).
export async function putShortenSettings(db, patch) {
  if (!db) throw new Error('no_db');
  const stmts = [];
  if (patch.baseUrl !== undefined) {
    if (patch.baseUrl === '') {
      stmts
      .push(db.prepare('DELETE FROM settings WHERE key = \'sink_base_url\''));
    } else {
      stmts.push(
        db.prepare(
          'INSERT INTO settings (key, value) VALUES (\'sink_base_url\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        ).bind(patch.baseUrl)
      );
    }
  }
  if (patch.token !== undefined && patch.token !== '') {
    stmts.push(
      db.prepare(
        'INSERT INTO settings (key, value) VALUES (\'sink_site_token\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).bind(patch.token)
    );
  }
  if (patch.enabled !== undefined) {
    stmts.push(
      db.prepare(
        'INSERT INTO settings (key, value) VALUES (\'shortlink_enabled\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).bind(patch.enabled ? '1' : '0')
    );
  }
  if (stmts.length) await db.batch(stmts);
}

// Share links for protected folders (extraction-code shares).
// Table: shares (slug, prefix, code_hash, created_by, created_at,
// expires_at NULL=permanent, enabled, failed_attempts, locked_until;
// schema: migrations/0002_add_shares.sql). Only the SHA-256 digest
// of the extraction code is stored; the code itself is returned to
// the admin exactly once at creation/regeneration and is never
// readable afterwards. The grant cookie is an HMAC over slug + expiry
// with SESSION_SECRET (same signing helper as the read session); the
// prefix itself is always re-resolved from the shares row, so
// revoking or expiring a share kills outstanding grant cookies
// immediately. When SESSION_SECRET is unset, no grant is ever issued
// or accepted (an empty-secret HMAC would be forgeable by anyone).
export const SHARE_COOKIE_NAME = 'fd_share_grant';
export const SHARE_GRANT_TTL_SECONDS = 24 * 3600;
export const SHARE_MAX_FAILED = 5;
export const SHARE_LOCK_SECONDS = 15 * 60;
const SHARE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

export function randomShareSlug() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let slug = '';
  for (const b of bytes) slug += SHARE_ALPHABET[b % SHARE_ALPHABET.length];
  return slug;
}

export function generateShareCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += SHARE_ALPHABET[b % SHARE_ALPHABET.length];
  return code;
}

export function isValidShareCode(code) {
  return typeof code === 'string' && /^[A-Za-z0-9]{4,8}$/.test(code);
}

export function isValidShareSlug(slug) {
  return typeof slug === 'string'
  && /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/.test(slug);
}

function cleanShareRow(row) {
  if (!row || typeof row.slug !== 'string') return null;
  const prefix = validatePrefix(row.prefix);
  if (!prefix) return null;
  if (typeof row.code_hash !== 'string'
  || !/^[0-9a-f]{64}$/.test(row.code_hash)) {
    return null;
  }
  return {
    slug: row.slug,
    prefix,
    codeHash: row.code_hash,
    createdBy: typeof row.created_by === 'string' ? row.created_by : '',
    createdAt: Number(row.created_at) || 0,
    expiresAt: row.expires_at === null || row.expires_at === undefined
      ? null
      : Number(row.expires_at),
    enabled: !!row.enabled,
    failedAttempts: Number(row.failed_attempts) || 0,
    lockedUntil: Number(row.locked_until) || 0,
  };
}

export async function getShareRow(db, slug) {
  if (!db || !isValidShareSlug(slug)) return null;
  try {
    const row = await db
      .prepare('SELECT * FROM shares WHERE slug = ?')
      .bind(slug)
      .first();
    return cleanShareRow(row);
  } catch {
    return null;
  }
}

// Public view of a share row: never includes the code hash.
export function publicShareRow(row) {
  return {
    slug: row.slug,
    prefix: row.prefix,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    enabled: row.enabled,
  };
}

export async function listShares(db) {
  if (!db) return null;
  try {
    const res = await db
      .prepare('SELECT * FROM shares ORDER BY created_at DESC, slug ASC')
      .all();
    if (!res.success) return null;
    const shares = [];
    for (const row of res.results || []) {
      const cleaned = cleanShareRow(row);
      if (cleaned) shares.push(publicShareRow(cleaned));
    }
    return shares;
  } catch {
    return null;
  }
}

// Inserts a share row, retrying on slug collision. Returns the slug,
// or null when no free slug was found.
export async function createShareRow(db,
{ prefix, codeHash, createdBy, expiresAt }) {
  if (!db) throw new Error('no_db');
  const now = Math.floor(Date.now() / 1000);
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = randomShareSlug();
    try {
      const res = await db
        .prepare(
          'INSERT INTO shares (slug, prefix, code_hash, created_by, created_at, expires_at, enabled, failed_attempts, locked_until) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0)'
        )
        .bind(slug, prefix, codeHash, createdBy || '', now, expiresAt)
        .run();
      if (res.success) return slug;
    } catch {
      // Slug collision (or transient error): retry with a fresh slug.
    }
  }
  return null;
}

export async function deleteShareRow(db, slug) {
  if (!db) throw new Error('no_db');
  await db.prepare('DELETE FROM shares WHERE slug = ?').bind(slug).run();
}

// Share -> Sink short-code mappings (migration 0003). The mapping is
// best-effort by design: recording happens after a successful shorten
// and must never fail the shorten itself, and revoking a share must
// never fail because Sink cleanup failed. A missing table means a
// pre-0003 database, which by definition holds no mappings.
export async function recordShareShortlink(db, slug, shortCode) {
  if (!db) return false;
  try {
    const res = await db
      .prepare(
        'INSERT OR IGNORE INTO share_shortlinks (short_code, slug, created_at) VALUES (?, ?, ?)'
      )
      .bind(shortCode, slug, Math.floor(Date.now() / 1000))
      .run();
    return !!res.success;
  } catch {
    return false;
  }
}

export async function listShareShortlinks(db, slug) {
  if (!db) throw new Error('no_db');
  try {
    const res = await db
      .prepare(
        'SELECT short_code FROM share_shortlinks WHERE slug = ? ORDER BY created_at'
      )
      .bind(slug)
      .all();
    if (!res.success) return null;
    return (res.results || [])
      .map((r) => r.short_code)
      .filter((c) => typeof c === 'string');
  } catch (e) {
    if (e && /no such table/i.test(e.message || '')) return [];
    return null;
  }
}

export async function deleteShareShortlink(db, shortCode) {
  if (!db) return;
  try {
    await db
      .prepare('DELETE FROM share_shortlinks WHERE short_code = ?')
      .bind(shortCode)
      .run();
  } catch {
    // Best-effort: a stale mapping row is harmless (the share is gone,
    // and a later revoke of the same slug re-reads the same row).
  }
}

// Sink configuration shared by shorten and share-revoke cleanup: the
// admin-managed D1 settings win when fully configured, otherwise the
// deployment's Pages secrets. The token must never travel in plaintext
// to a non-local host, so plain http is accepted ONLY for loopback
// hosts (local mock Sink verification).
export async function resolveSinkConfig(context, db) {
  const adminShorten = await getShortenSettings(db);
  let base = '';
  let token = '';
  if (adminShorten.configured) {
    base = adminShorten.baseUrl.replace(/\/+$/, '');
    token = adminShorten.token;
  } else {
    base = (context.env['SINK_BASE_URL'] || '').replace(/\/+$/, '');
    token = context.env['SINK_SITE_TOKEN'] || '';
  }
  const isLoopback =
    base.startsWith('http://127.0.0.1') || base.startsWith('http://localhost');
  const usable = (base.startsWith('https://') || isLoopback) && token !== '';
  return { base, token, usable };
}

export async function regenerateShareCode(db, slug, codeHash) {
  if (!db) throw new Error('no_db');
  await db
    .prepare(
      'UPDATE shares SET code_hash = ?, failed_attempts = 0, locked_until = 0 WHERE slug = ?'
    )
    .bind(codeHash, slug)
    .run();
}

export async function recordShareFailure(db, row) {
  if (!db) throw new Error('no_db');
  const now = Math.floor(Date.now() / 1000);
  const failed = (row.failedAttempts || 0) + 1;
  if (failed >= SHARE_MAX_FAILED) {
    await db
      .prepare('UPDATE shares SET failed_attempts = ?, locked_until = ? WHERE slug = ?')
      .bind(failed, now + SHARE_LOCK_SECONDS, row.slug)
      .run();
  } else {
    await db
      .prepare('UPDATE shares SET failed_attempts = ? WHERE slug = ?')
      .bind(failed, row.slug)
      .run();
  }
}

export async function clearShareFailures(db, slug) {
  if (!db) throw new Error('no_db');
  await db
    .prepare('UPDATE shares SET failed_attempts = 0, locked_until = 0 WHERE slug = ?')
    .bind(slug)
    .run();
}

export async function createShareGrantValue(env, slug) {
  const secret = env['SESSION_SECRET'] || '';
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + SHARE_GRANT_TTL_SECONDS;
  const payload = `${slug}.${exp}`;
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

export function shareGrantCookieHeader(value) {
  return `${SHARE_COOKIE_NAME}=${value}; Path=/; Max-Age=${SHARE_GRANT_TTL_SECONDS}; HttpOnly; SameSite=Lax; Secure`;
}

function parseShareGrantCookie(request) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SHARE_COOKIE_NAME}=`)) {
      return trimmed.slice(SHARE_COOKIE_NAME.length + 1);
    }
  }
  return null;
}

// Resolves the request's share-grant cookie to { slug, prefix }, or
// null. The cookie alone grants nothing: the shares row must exist,
// be enabled, and be unexpired, so revocation/expiry take effect
// immediately. A missing/empty SESSION_SECRET never verifies.
export async function verifyShareGrant(context, db) {
  try {
    const secret = context.env['SESSION_SECRET'] || '';
    if (!secret || !db) return null;
    const value = parseShareGrantCookie(context.request);
    if (!value) return null;
    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const [slug, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    const expected = await hmacHex(secret, `${slug}.${expStr}`);
    if (!timingSafeEqual(expected, sig)) return null;
    const row = await getShareRow(db, slug);
    if (!row || !row.enabled) return null;
    const now = Math.floor(Date.now() / 1000);
    if (row.expiresAt !== null && row.expiresAt <= now) return null;
    return { slug: row.slug, prefix: row.prefix };
  } catch {
    return null;
  }
}

// Whether a share grant covers a path (the grant prefix itself, or
// any path under it). Nested protection inside a shared subtree is
// covered: an explicit share wins over inner protected prefixes.
export function shareGrantCovers(grant, path) {
  if (!grant) return false;
  return prefixMatches((path || '').replace(/^\/+/, ''), grant.prefix);
}

// Longest-prefix rule for one user on one path, or null when no rule
// covers the path. Longest prefix wins; ties keep the first rule.
function longestRuleForUser(rules, user, path) {
  let best = null;
  for (const rule of rules || []) {
    if (rule.user !== user) continue;
    if (!prefixMatches(path, rule.prefix)) continue;
    if (!best || rule.prefix.length > best.prefix.length) best = rule;
  }
  return best;
}

// Read check. Unprotected paths are open to everyone. Admins read
// everything. Otherwise the longest matching rule for the caller
// decides: read/write allow, none or no rule denies. The legacy
// `prefixes` identity field is kept as a fallback only when no rule
// covers the path (old single-account callers pass no rules).
export function canReadPath(path, identity, protectedList, rules) {
  const p = (path || '').replace(/^\/+/, '');
  if (!isProtectedPath(p, protectedList)) return true;
  if (!identity) return false;
  if (identity.isAdmin) return true;
  const rule = longestRuleForUser(rules || [], identity.user, p);
  if (rule) return rule.access === 'read' || rule.access === 'write';
  return (identity.prefixes || []).some((prefix) => prefixMatches(p, prefix));
}

// Write check. Admins write everything. Otherwise only the longest
// matching rule with access "write" allows; read/none/no rule deny.
// (Unlike reads, there is no unprotected-path allowance here: DAV
// writes and admin file operations always need an identity with
// write access, matching the old "no anonymous writes" rule.)
export function canWritePath(path, identity, rules) {
  const p = (path || '').replace(/^\/+/, '');
  if (!identity) return false;
  if (identity.isAdmin) return true;
  const rule = longestRuleForUser(rules || [], identity.user, p);
  return !!rule && rule.access === 'write';
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64urlEncode(text) {
  let binary = '';
  const bytes = new TextEncoder().encode(text);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,
  '-').replace(/\//g,
  '_').replace(/=+$/,
  '');
}

function base64urlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function createSessionValue(env, user) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${base64urlEncode(user)}.${exp}`;
  const sig = await hmacHex(env['SESSION_SECRET'] || '', payload);
  return `${payload}.${sig}`;
}

function identityFromAccountRow(row) {
  return {
    user: row.user,
    isAdmin: row.role === 'admin',
    davEnabled: !!row.davEnabled,
    prefixes: [],
  };
}

function identityFromEnvAdmin(admin) {
  return { user: admin.user, isAdmin: true, davEnabled: true, prefixes: [] };
}

// Resolves a username to an identity. Accounts table first (only
// enabled rows); when the table is missing (no DB binding), the query
// fails, or the table has no such user, falls back to the legacy env
// admin. A disabled table row is authoritative for its name: it does
// NOT fall back to the env admin.
async function resolveUser(env, db, user) {
  const admin = getAdminAccount(env);
  const accounts = await getAccountsConfig(db);
  if (accounts && accounts.present && !accounts.corrupted) {
    const row = accounts.users.find((u) => u.user === user);
    if (row) {
      return row.enabled ? identityFromAccountRow(row) : null;
    }
    // User not in the library: fall through to the env admin.
  }
  // Missing/corrupt library, or user not in it: env admin only.
  if (admin && user === admin.user) return identityFromEnvAdmin(admin);
  return null;
}

// Resolves username + password to an identity (login path). Same
// precedence as resolveUser, except a table row that exists but
// fails the password check is authoritative: no env fallback for
// that name, so a wrong table password never falls through.
async function authenticateUser(env, db, username, password) {
  const hash = await sha256Hex(password);
  const admin = getAdminAccount(env);
  const accounts = await getAccountsConfig(db);
  if (accounts && accounts.present && !accounts.corrupted) {
    const row = accounts.users.find((u) => u.user === username);
    if (row) {
      if (!row.enabled) return null;
      return timingSafeEqual(hash, row.passHash)
        ? identityFromAccountRow(row)
        : null;
    }
    // Not in the library: fall through to the env admin.
  }
  if (admin && username === admin.user && timingSafeEqual(hash,
  admin.passHash)) {
    return identityFromEnvAdmin(admin);
  }
  return null;
}

async function verifySessionValue(env, value, db) {
  try {
    const parts = (value || '').split('.');
    if (parts.length !== 3) return null;
    const [userB64, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    const expected = await hmacHex(env['SESSION_SECRET'] || '', `${userB64}.${expStr}`);
    if (!timingSafeEqual(expected, sig)) return null;
    const user = base64urlDecode(userB64);
    return resolveUser(env, db, user);
  } catch {
    return null;
  }
}

function parseBasicAuth(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice('Basic '.length).trim());
    const colon = decoded.indexOf(':');
    if (colon < 0) return null;
    return { user: decoded.slice(0, colon),
    password: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

function parseSessionCookie(request) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${COOKIE_NAME}=`)) {
      return trimmed.slice(COOKIE_NAME.length + 1);
    }
  }
  return null;
}

// Cookie-session identity only. Used by management endpoints, which
// must never accept Basic Auth. Second argument is the D1 binding
// (or null when unbound; env-admin sessions still verify).
export async function getSessionIdentity(context, db) {
  const cookieValue = parseSessionCookie(context.request);
  if (!cookieValue) return null;
  return verifySessionValue(context.env, cookieValue, db);
}

// Cookie session first, then Basic Auth. Used by reads (children, raw,
// DAV) and by the shorten proxy's protected-target check. Second
// argument is the D1 binding (or null when unbound).
export async function getReadIdentity(context, db) {
  const fromCookie = await getSessionIdentity(context, db);
  if (fromCookie) return fromCookie;
  const basic = parseBasicAuth(context.request);
  if (!basic) return null;
  // Basic Auth against the same resolution as login: accounts table
  // first (enabled rows only, exact hash), env admin as fallback.
  return authenticateUser(context.env, db, basic.user, basic.password);
}

// Login helper shared by /api/auth/login: accounts table or legacy
// env admin, uniform failure (callers must not distinguish "no such
// user" from "wrong password").
export async function authenticateLogin(env, db, username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return null;
  }
  // Always hash once so timing does not reveal which branch ran.
  return authenticateUser(env, db, username, password);
}

// Whether the request presented credentials (cookie or Basic) that
// resolve to a valid, enabled account which is NOT DAV-enabled.
// DAV rejects such callers with 401 even on public paths: the account
// itself is valid, but it is not allowed to use DAV at all.
export async function isDavDisabledIdentity(context, db) {
  const identity = await getReadIdentity(context, db);
  if (!identity || identity.isAdmin || identity.davEnabled) return false;
  return true;
}

// Management-endpoint gate: cookie session only, admin only.
// Returns the identity, or a Response to return directly (401 when
// unauthenticated — including Basic Auth, which is never accepted
// here — 403 when authenticated but not an admin).
export async function requireAdminCookie(context, db) {
  const identity = await getSessionIdentity(context, db);
  if (!identity) return authRequiredResponse();
  if (!identity.isAdmin) return forbiddenResponse();
  return identity;
}

export function sessionCookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`;
}

export function clearSessionCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
}

export function authRequiredResponse() {
  const headers = new Headers();
  headers.set('WWW-Authenticate', 'Basic realm="FlareDrive"');
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({ error: 'login_required' }), {
    status: 401,
    headers,
  });
}

export function forbiddenResponse() {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function configCorruptResponse() {
  return new Response(JSON.stringify({ error: 'protection_config_corrupt' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
