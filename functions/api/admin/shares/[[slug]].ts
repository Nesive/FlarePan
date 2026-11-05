// Share management (cookie-session admin only).
// GET    /api/admin/shares -> { shares: [{ slug, prefix, createdBy,
//   createdAt, expiresAt, enabled, lockedUntil, shortlinkCount? }] } —
//   never the code or its hash. shortlinkCount is the number of
//   recorded Sink short links for the share (one GROUP BY, no N+1);
//   it is omitted when the count query fails.
// POST   /api/admin/shares { prefix, code?, expiresIn? } -> 201
//   { slug, prefix, shareUrl, code, expiresAt, createdAt }.
//   The code is returned exactly once here; no later endpoint ever
//   returns it again. prefix must currently be protected, otherwise
//   the share is refused (an unprotected folder needs no share).
//   code: empty/missing = auto-generated 4 chars (no 0/O/1/l);
//   custom codes are 4-8 alphanumeric chars. expiresIn:
//   "permanent" | "7d" | "30d" (default "30d").
// POST   /api/admin/shares { action: "purge_expired" } ->
//   { purged: [slug], purgedCount, sinkFailures? }: deletes every
//   expired share and its recorded Sink short links (same cleanup
//   and sinkFailures reporting as revoking one share).
// DELETE /api/admin/shares/<slug> -> { ok: true }; the link and the
//   code die together, and outstanding grant cookies stop verifying
//   because the row is gone. Revoking also deletes the share's Sink
//   short links (recorded in share_shortlinks when they were created):
//   each recorded code is removed via Sink's delete endpoint, which
//   hard-deletes the link and leaves a tombstone, so the short link
//   dies immediately and its slug cannot be revived from cache. Sink
//   has no recycle bin, so there is nothing to restore afterwards.
//   Sink cleanup never fails the revoke itself: any code that could
//   not be deleted stays mapped and is reported in sinkFailures
//   [{ shortCode, status }] for manual cleanup in the Sink dashboard.
// POST   /api/admin/shares/<slug> { action: "regenerate", code? } ->
//   { slug, shareUrl, code }: the slug and link stay the same, the
//   old code stops working, the new code is returned exactly once.
//   Regeneration also clears any lockout.
// POST   /api/admin/shares/<slug> { action: "disable" | "enable" } ->
//   { slug, enabled }: the share page and verify endpoints already
//   refuse enabled = 0, so disabling takes effect immediately for
//   plain links, with-code links and short links alike.
// GET    /api/admin/shares/<slug>/shortlinks ->
//   { slug, sinkConfigured, shortlinks: [{ shortCode, shortLink,
//   targetKind, createdAt }] }. targetKind is 'plain' | 'with_code'
//   (migration 0006) or null for rows recorded before 0006, shown in
//   the UI as unknown type. shortLink is null when Sink is not
//   configured; the short code itself is still listed.
// DELETE /api/admin/shares/<slug>/shortlinks/<code> -> { ok: true }:
//   deletes only that one Sink short link plus its mapping row; the
//   share, its other short links and its code are untouched. When the
//   Sink delete fails the mapping is kept and the failure is reported
//   as { ok: false, sinkFailures: [{ shortCode, status }] } with a
//   502 — never a false success.
//
// One catch-all file serves the bare path, the per-share path and the
// per-share shortlinks path: Pages routes /api/admin/shares here with
// an empty slug, so a sibling shares.ts + shares/[[slug]].ts pair
// would shadow each other (the catch-all answered the bare path with
// 405) — the same quirk the accounts endpoint already documents.

import {
  countShareShortlinks,
  createShareRow,
  deleteShareRow,
  deleteShareShortlink,
  generateShareCode,
  getProtectionConfig,
  getShareRow,
  isProtectedPath,
  isValidShareCode,
  listExpiredShareSlugs,
  listShareShortlinkRows,
  listShareShortlinks,
  listShares,
  regenerateShareCode,
  requireAdminCookie,
  resolveSinkConfig,
  setShareEnabled,
  sha256Hex,
  validatePrefix,
} from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parsePath(context) {
  const raw = context.params.slug;
  const arr = raw === undefined || raw === null
    ? []
    : (Array.isArray(raw) ? raw : [raw]);
  const out = [];
  for (const p of arr) {
    try {
      const d = decodeURIComponent(p);
      if (d) out.push(d);
    } catch {
      out.push('');
    }
  }
  return out;
}

async function handleList(context, db) {
  const shares = await listShares(db);
  if (shares === null) return json({ error: 'share_config_corrupt' }, 500);
  const counts = await countShareShortlinks(db);
  if (counts) {
    for (const s of shares) s.shortlinkCount = counts[s.slug] || 0;
  }
  return json({ shares });
}

async function handleCreate(context, db, gate, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'bad_request' }, 400);
  }
  const prefix = validatePrefix(body.prefix);
  if (prefix === null) return json({ error: 'invalid_prefix' }, 400);
  const config = await getProtectionConfig(db);
  if (config.corrupted) return json({ error: 'protection_config_corrupt' },
  500);
  if (!isProtectedPath(prefix, config.protected)) {
    return json({ error: 'not_protected' }, 400);
  }
  let code;
  if (body.code === undefined || body.code === '') {
    code = generateShareCode();
  } else {
    if (!isValidShareCode(body.code)) return json({ error: 'invalid_code' },
    400);
    code = body.code;
  }
  const expiresIn = body.expiresIn === undefined ? '30d' : body.expiresIn;
  let expiresAt = null;
  if (expiresIn === 'permanent') {
    expiresAt = null;
  } else if (expiresIn === '7d' || expiresIn === '30d') {
    const days = expiresIn === '7d' ? 7 : 30;
    expiresAt = Math.floor(Date.now() / 1000) + days * 24 * 3600;
  } else {
    return json({ error: 'invalid_expires' }, 400);
  }
  const codeHash = await sha256Hex(code);
  const slug = await createShareRow(db, {
    prefix,
    codeHash,
    createdBy: gate.user,
    expiresAt,
  });
  if (!slug) return json({ error: 'share_create_failed' }, 500);
  return json(
    {
      slug,
      prefix,
      shareUrl: `/s/${slug}`,
      code,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt,
    },
    201
  );
}

async function handleDelete(context, db, slug) {
  const row = await getShareRow(db, slug);
  if (!row) return json({ error: 'share_not_found' }, 404);
  await deleteShareRow(db, slug);
  const sinkFailures = await deleteShareShortlinks(context, db, slug);
  return json(sinkFailures.length ? { ok: true, sinkFailures } : { ok: true });
}

// Deletes one Sink short link. Returns { ok: true } when Sink confirms
// (or 404s: the code is already gone, same end state), otherwise
// { ok: false, status } and the caller keeps the mapping row.
async function deleteOneSinkShortlink(context, db, shortCode) {
  const { base, token, usable } = await resolveSinkConfig(context, db);
  if (!usable) return { ok: false, status: 'sink_not_configured' };
  let res = null;
  try {
    res = await fetch(`${base}/api/link/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        // Same bot-mitigation note as shorten.ts: the Sink zone drops
        // non-browser clients on API paths.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ slug: shortCode }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, status: 'sink_unreachable' };
  }
  if (res.ok || res.status === 404) return { ok: true, status: '' };
  return { ok: false, status: `sink_error_${res.status}` };
}

// Deletes every Sink short link recorded for this share. Returns the
// codes that could not be deleted (their mappings are kept, so the
// failure stays visible for a later manual cleanup). The share itself
// is already gone at this point, so this must never throw: every
// failure mode is reported, never raised.
async function deleteShareShortlinks(context, db, slug) {
  const codes = await listShareShortlinks(db, slug);
  if (codes === null) return [{ shortCode: '', status: 'mapping_read_failed' }];
  if (!codes.length) return [];
  const failures = [];
  for (const shortCode of codes) {
    const r = await deleteOneSinkShortlink(context, db, shortCode);
    if (r.ok) {
      await deleteShareShortlink(db, shortCode);
    } else {
      failures.push({ shortCode, status: r.status });
    }
  }
  return failures;
}

async function handlePostShare(context, db, slug) {
  const row = await getShareRow(db, slug);
  if (!row) return json({ error: 'share_not_found' }, 404);
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'bad_request' }, 400);
  }
  if (body.action === 'disable' || body.action === 'enable') {
    const enabled = body.action === 'enable';
    await setShareEnabled(db, slug, enabled);
    return json({ slug, enabled });
  }
  if (body.action !== 'regenerate') {
    return json({ error: 'bad_request' }, 400);
  }
  let code;
  if (body.code === undefined || body.code === '') {
    code = generateShareCode();
  } else {
    if (!isValidShareCode(body.code)) return json({ error: 'invalid_code' },
    400);
    code = body.code;
  }
  await regenerateShareCode(db, slug, await sha256Hex(code));
  return json({ slug, shareUrl: `/s/${slug}`, code });
}

async function handleShortlinksList(context, db, slug) {
  const row = await getShareRow(db, slug);
  if (!row) return json({ error: 'share_not_found' }, 404);
  const rows = await listShareShortlinkRows(db, slug);
  if (rows === null) return json({ error: 'share_shortlinks_corrupt' }, 500);
  const sink = await resolveSinkConfig(context, db);
  return json({
    slug,
    sinkConfigured: sink.usable,
    shortlinks: rows.map((r) => ({
      shortCode: r.shortCode,
      shortLink: sink.usable ? `${sink.base}/${r.shortCode}` : null,
      targetKind: r.targetKind,
      createdAt: r.createdAt,
    })),
  });
}

async function handleShortlinkDelete(context, db, slug, shortCode) {
  const row = await getShareRow(db, slug);
  if (!row) return json({ error: 'share_not_found' }, 404);
  const rows = await listShareShortlinkRows(db, slug);
  if (rows === null) return json({ error: 'share_shortlinks_corrupt' }, 500);
  if (!rows.some((r) => r.shortCode === shortCode)) {
    return json({ error: 'share_shortlink_not_found' }, 404);
  }
  const r = await deleteOneSinkShortlink(context, db, shortCode);
  if (!r.ok) {
    return json({
      ok: false,
      sinkFailures: [{ shortCode, status: r.status }],
    }, 502);
  }
  await deleteShareShortlink(db, shortCode);
  return json({ ok: true });
}

async function handlePurge(context, db) {
  const now = Math.floor(Date.now() / 1000);
  const slugs = await listExpiredShareSlugs(db, now);
  if (slugs === null) return json({ error: 'share_config_corrupt' }, 500);
  const purged = [];
  const sinkFailures = [];
  for (const slug of slugs) {
    await deleteShareRow(db, slug);
    const failures = await deleteShareShortlinks(context, db, slug);
    for (const f of failures) sinkFailures.push(f);
    purged.push(slug);
  }
  const body = { purged, purgedCount: purged.length };
  if (sinkFailures.length) body.sinkFailures = sinkFailures;
  return json(body);
}

export async function onRequest(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;
  const parts = parsePath(context);
  const method = context.request.method;
  if (parts.length === 0) {
    if (method === 'GET') return handleList(context, db);
    if (method === 'POST') {
      let body;
      try {
        body = await context.request.json();
      } catch {
        return json({ error: 'bad_request' }, 400);
      }
      if (body && typeof body === 'object' && !Array.isArray(body)
        && body.action === 'purge_expired') {
        return handlePurge(context, db);
      }
      return handleCreate(context, db, gate, body);
    }
    return json({ error: 'method_not_allowed' }, 405);
  }
  const slug = parts[0];
  if (parts.length === 2 && parts[1] === 'shortlinks') {
    if (method === 'GET') return handleShortlinksList(context, db, slug);
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (parts.length === 3 && parts[1] === 'shortlinks') {
    if (method === 'DELETE') {
      return handleShortlinkDelete(context, db, slug, parts[2]);
    }
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (parts.length !== 1) {
    return method === 'GET'
      ? json({ error: 'method_not_allowed' }, 405)
      : json({ error: 'share_not_found' }, 404);
  }
  if (method === 'DELETE') return handleDelete(context, db, slug);
  if (method === 'POST') return handlePostShare(context, db, slug);
  return json({ error: 'method_not_allowed' }, 405);
}
