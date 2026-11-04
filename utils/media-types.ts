// Extension -> Content-Type for video files, shared by /raw/ serving
// (utils/r2serve.ts) and the children listing (functions/api/children).
//
// Only fills in a type when the stored one is missing or
// application/octet-stream; a real stored type is never overridden.
// That matters for ambiguous extensions: a .ts TypeScript source keeps
// its text/plain, while a .ts video stored as octet-stream becomes
// video/mp2t.
export const VIDEO_CONTENT_TYPES = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  mkv: 'video/x-matroska',
  mk3d: 'video/x-matroska',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  wmx: 'video/x-ms-wmx',
  wvx: 'video/x-ms-wvx',
  asf: 'video/x-ms-asf',
  asx: 'video/x-ms-asf',
  flv: 'video/x-flv',
  f4v: 'video/mp4',
  rm: 'application/vnd.rn-realmedia',
  rmvb: 'application/vnd.rn-realmedia-vbr',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  '3gpp': 'video/3gpp',
  ts: 'video/mp2t',
  mts: 'video/mp2t',
  m2ts: 'video/mp2t',
  tod: 'video/mp2t',
  vob: 'video/mpeg',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  mpe: 'video/mpeg',
  mpv: 'video/mpeg',
  m2v: 'video/mpeg',
  mp2v: 'video/mpeg',
  m3u8: 'application/vnd.apple.mpegurl',
  divx: 'video/divx',
  wm: 'video/x-ms-wm',
  ogm: 'application/ogg',
};

// Returns the video Content-Type for key when the stored type is
// unknown, or null when the stored type should be kept as-is.
export function normalizeVideoContentType(key, storedType) {
  const type = (storedType || '').trim();
  if (type && type !== 'application/octet-stream') return null;
  const dot = key.lastIndexOf('.');
  if (dot < 0) return null;
  return VIDEO_CONTENT_TYPES[key.slice(dot + 1).toLowerCase()] || null;
}
