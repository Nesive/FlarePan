// Share info (public, no auth). GET /api/share/<slug> ->
//   { valid, expired }. Never leaks the prefix or the code: an
//   unknown, disabled, or malformed slug reads exactly like a
//   nonexistent share; only a genuinely expired row reports
//   expired:true (expired links are dead either way).
import { getShareRow } from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const segs = context.params.slug || [];
  const slug = Array.isArray(segs) ? segs[0] || '' : segs || '';
  const db = context.env['DB'] || null;
  const row = await getShareRow(db, slug);
  if (!row || !row.enabled) return json({ valid: false, expired: false });
  const now = Math.floor(Date.now() / 1000);
  if (row.expiresAt !== null && row.expiresAt <= now) {
    return json({ valid: false, expired: true });
  }
  return json({ valid: true, expired: false });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ error: 'method_not_allowed' }, 405);
}
