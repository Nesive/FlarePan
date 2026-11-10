// Folder-marker convention: R2/S3 has no real folders, so an empty
// folder is materialised by a zero-byte object "<folder>/_$folder$".
// Markers are storage internals and must never be visible as files,
// servable as content, or writable through user-facing paths. The
// only writers are mkdir (admin files action) and MKCOL (DAV), which
// create exactly one marker per folder. Any key whose last segment is
// "_$folder$" IS a marker; any key with "_$folder$" as a non-final
// segment sits under a marker and is equally reserved (no user file
// may ever live there, and no file may be named "_$folder$").

export const FOLDER_MARKER_NAME = '_$folder$';

export function isFolderMarker(key) {
  if (typeof key !== 'string' || !key) return false;
  const segments = key.split('/').filter((s) => s !== '');
  return segments.length > 0
    && segments[segments.length - 1] === FOLDER_MARKER_NAME;
}

export function hasFolderMarkerSegment(key) {
  if (typeof key !== 'string' || !key) return false;
  return key.split('/').some((s) => s === FOLDER_MARKER_NAME);
}
