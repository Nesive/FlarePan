// Public site feature flags. No secrets here: only values the frontend
// or API users need before acting (short-link master switch, per-file
// upload cap). When D1 is unbound, defaults preserve the historical
// behavior so an old deployment keeps working.
import { getShortenSettings } from '@/utils/read-auth';
import { getUploadLimits } from '@/utils/upload-limits';

export async function onRequestGet(context) {
  const db = context.env['DB'] || null;
  let shortlinkEnabled = true;
  let maxFileMb = 500;
  if (db) {
    try {
      const settings = await getShortenSettings(db);
      shortlinkEnabled = settings.enabled;
      const limits = await getUploadLimits(db);
      maxFileMb = limits.maxFileMb;
    } catch {
      // Fall through with the defaults.
    }
  }
  return new Response(JSON.stringify({
    shortlink_enabled: shortlinkEnabled,
    upload_max_file_mb: maxFileMb,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
