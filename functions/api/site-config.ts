// Public site feature flags. No secrets here: only values the frontend
// or API users need before acting (short-link master switch, per-file
// upload cap, theme skin). When D1 is unbound, defaults preserve the
// historical behavior so an old deployment keeps working.
import { getShortenSettings } from '@/utils/read-auth';
import { getUploadLimits } from '@/utils/upload-limits';

const VALID_SKINS = ['original', 'starship'];

async function getSkin(db) {
  if (!db) return 'original';
  try {
    const row = await db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .bind('skin')
      .first();
    const value = row ? row.value : null;
    return VALID_SKINS.includes(value) ? value : 'original';
  } catch {
    return 'original';
  }
}

export async function onRequestGet(context) {
  const db = context.env['DB'] || null;
  let shortlinkEnabled = true;
  let maxFileMb = 500;
  let skin = 'original';
  if (db) {
    try {
      const settings = await getShortenSettings(db);
      shortlinkEnabled = settings.enabled;
      const limits = await getUploadLimits(db);
      maxFileMb = limits.maxFileMb;
      skin = await getSkin(db);
    } catch {
      // Fall through with the defaults.
    }
  }
  return new Response(JSON.stringify({
    shortlink_enabled: shortlinkEnabled,
    upload_max_file_mb: maxFileMb,
    skin,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
