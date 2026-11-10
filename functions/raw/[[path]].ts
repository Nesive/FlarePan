import { notFound, parseBucketPath } from '@/utils/bucket';
import { isFolderMarker } from '@/utils/folder-marker';
import { serveR2Object } from '@/utils/r2serve';
import {
  authRequiredResponseNoChallenge,
  canReadPath,
  configCorruptResponse,
  forbiddenResponse,
  getPermissionsConfig,
  getProtectionConfig,
  getReadIdentity,
  isBrowserNavigation,
  shareGrantCovers,
  verifyShareGrant,
} from '@/utils/read-auth';

// Serves files straight from the R2 binding (not via the public r2.dev
// URL as before), so downloads keep working after public access on the
// bucket is closed. Folder protection applies here too: a protected key
// needs an authenticated caller with access to its prefix. Thumbnails
// under _$flaredrive$/ stay public, matching the existing write-side
// exception for that internal prefix.

async function handle(context) {
  const [bucket, path] = parseBucketPath(context);
  const db = context.env['DB'] || null;
  if (!bucket) return notFound();

  // A folder marker is a storage internal, never content: it is not
  // downloadable or previewable even when the URL is guessed.
  if (isFolderMarker(path)) return notFound();

  // Transcode internals are never web-servable via /raw/: the cache
  // inherits the source's protection and is only served via /transcode/.
  if (
    path.startsWith('_$transcoded$/') ||
    path.startsWith('_$transcode-jobs$/')
  ) {
    return notFound();
  }

  const isThumbnail = path.startsWith('_$flaredrive$/thumbnails/');
  if (!isThumbnail) {
    const config = await getProtectionConfig(db);
    if (config.corrupted) return configCorruptResponse();
    const permConfig = await getPermissionsConfig(db);
    const rules = permConfig.corrupted ? [] : permConfig.rules;
    const identity = await getReadIdentity(context, db);
    // Share grants are a second, independent read credential (see
    // children); DAV never consults them, so shares are web-only.
    const grant = await verifyShareGrant(context, db);
    if (
      !canReadPath(path, identity, config.protected, rules) &&
      !shareGrantCovers(grant, path)
    ) {
      if (!identity && !grant) {
        // Top-level navigation (user opening the file link in a tab):
        // send the browser back to the site, which pops the themed
        // login dialog and returns here after login. Any other
        // request gets the plain JSON 401 — never a native dialog.
        if (isBrowserNavigation(context.request)) {
          const u = new URL(context.request.url);
          const next = encodeURIComponent(u.pathname + u.search);
          return Response.redirect(
            new URL(`/?login=1&next=${next}`, u.origin).toString(),
            302
          );
        }
        return authRequiredResponseNoChallenge();
      }
      return forbiddenResponse();
    }
  }

  const extraHeaders = {};
  if (isThumbnail) {
    extraHeaders['Cache-Control'] = 'max-age=31536000';
  }
  return serveR2Object(context, bucket, path, extraHeaders);
}

export async function onRequestGet(context) {
  return handle(context);
}

export async function onRequestHead(context) {
  return handle(context);
}
