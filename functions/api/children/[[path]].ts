import { notFound, parseBucketPath } from '@/utils/bucket';
import { isFolderMarker, hasFolderMarkerSegment } from '@/utils/folder-marker';
import { normalizeVideoContentType } from '@/utils/media-types';
import {
  authRequiredResponseNoChallenge,
  canReadPath,
  configCorruptResponse,
  forbiddenResponse,
  getPermissionsConfig,
  getProtectionConfig,
  getReadIdentity,
  isProtectedPath,
  shareGrantCovers,
  verifyShareGrant,
} from '@/utils/read-auth';

export async function onRequestGet(context) {
  try {
    const [bucket, path] = parseBucketPath(context);
    const db = context.env['DB'] || null;
    const prefix = path && `${path}/`;
    if (!bucket || prefix.startsWith('_$flaredrive$/')) return notFound();

    // Folder protection (caliber B): a protected prefix is hidden from
    // listings unless the caller is authenticated for it. Listing the
    // protected prefix itself directly challenges for login instead of
    // pretending it is empty, so the UI can pop the login dialog.
    const config = await getProtectionConfig(db);
    if (config.corrupted) return configCorruptResponse();
    // A corrupt permissions library reads as no rules: non-admins see
    // no protected path, admins are unaffected.
    const permConfig = await getPermissionsConfig(db);
    const rules = permConfig.corrupted ? [] : permConfig.rules;
    const identity = await getReadIdentity(context, db);
    // Share grants are a second, independent read credential: they
    // cover exactly one shared subtree and never widen account
    // access. DAV does not consult grants at all (it never calls
    // this helper), so shares are web-only by construction.
    const grant = await verifyShareGrant(context, db);
    const listPath = path || '';
    if (isProtectedPath(listPath, config.protected)) {
      if (!identity && !grant) return authRequiredResponseNoChallenge();
      if (
        !canReadPath(listPath, identity, config.protected, rules) &&
        !shareGrantCovers(grant, listPath)
      ) {
        return forbiddenResponse();
      }
    }

    const objList = await bucket.list({
      prefix,
      delimiter: '/',
      include: ['httpMetadata', 'customMetadata'],
    });
    const objKeys = objList.objects
      // Folder markers are storage internals, never user files: hide
      // them here (and in every other listing) via the shared helper
      // so a future rename of the convention cannot leak again.
      .filter((obj) => !isFolderMarker(obj.key))
      // Transcode internals never appear in listings (same as the
      // _$flaredrive$/ system prefix below); they are only served
      // via /transcode/ under the source's protection.
      .filter(
        (obj) =>
          !obj.key.startsWith('_$transcoded$/') &&
          !obj.key.startsWith('_$transcode-jobs$/')
      )
      .filter(
        (obj) =>
          !isProtectedPath(obj.key, config.protected) ||
          canReadPath(obj.key, identity, config.protected, rules) ||
          shareGrantCovers(grant, obj.key)
      )
      .map((obj) => {
        const { key, size, uploaded, httpMetadata, customMetadata } = obj;
        // 列表也补视频类型：存量类型未知的文件靠扩展名认成视频，
        // 旧版前端（只认 contentType video/* 开头）同样能站内播放。
        const storedType =
          (httpMetadata && httpMetadata.contentType) || '';
        const normalizedVideoType = normalizeVideoContentType(
          key,
          storedType
        );
        return {
          key,
          size,
          uploaded,
          httpMetadata: normalizedVideoType
            ? { ...httpMetadata, contentType: normalizedVideoType }
            : httpMetadata,
          customMetadata,
        };
      });

    let folders = objList.delimitedPrefixes.filter(
      (folder) =>
        // A folder named "_$folder$" can only come from an object
        // stored under a marker path; never show it as a folder.
        !hasFolderMarkerSegment(folder) &&
        !folder.startsWith('_$transcoded$/') &&
        !folder.startsWith('_$transcode-jobs$/') &&
        (!isProtectedPath(folder, config.protected) ||
          canReadPath(folder, identity, config.protected, rules) ||
          shareGrantCovers(grant, folder))
    );
    if (!path)
      folders = folders.filter((folder) => folder !== '_$flaredrive$/');

    return new Response(JSON.stringify({ value: objKeys, folders }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(e.toString(), { status: 500 });
  }
}
