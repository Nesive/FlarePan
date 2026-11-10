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

// Extension -> Content-Type for common non-video file types, used by
// the simple-PUT write path (functions/api/write/items) so a file
// uploaded without a Content-Type header is still stored with a usable
// type instead of application/octet-stream (which makes browsers
// download it instead of displaying it inline).
export const CONTENT_TYPES_BY_EXTENSION = {
  // Text
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  xml: 'text/xml',
  svg: 'image/svg+xml',
  log: 'text/plain',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  aac: 'audio/aac',
  opus: 'audio/opus',
  // Documents / archives
  pdf: 'application/pdf',
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  epub: 'application/epub+zip',
  // Fonts
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  // Installers
  exe: 'application/x-msdownload',
  apk: 'application/vnd.android.package-archive',
  dmg: 'application/x-apple-diskimage',
  // .pkg/.mpkg: IANA-registered application/vnd.apple.installer+xml
  // (registered 2005-11-30, file extensions listed as dist, distz,
  // pkg, mpkg; intended usage is to identify that the Apple Installer
  // application should open the file). A modern flat .pkg is xar-based,
  // but the IANA registration is the authoritative mapping for the
  // extension, so it wins over the generic application/x-xar claim.
  pkg: 'application/vnd.apple.installer+xml',
  mpkg: 'application/vnd.apple.installer+xml',
};

// Returns the Content-Type inferred from the key's extension, or null
// when the extension is unknown or ambiguous. `ts` is deliberately
// excluded: it is ambiguous between TypeScript source (text/plain) and
// MPEG-TS video (video/mp2t). Leaving it out keeps the stored type
// application/octet-stream, and the /raw/ read side already normalizes
// octet-stream .ts to video/mp2t for display.
export function inferContentType(key) {
  const dot = key.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = key.slice(dot + 1).toLowerCase();
  if (ext === 'ts') return null;
  return CONTENT_TYPES_BY_EXTENSION[ext]
    || VIDEO_CONTENT_TYPES[ext]
    || null;
}

// Content-Type to store for an upload: a real declared header wins;
// otherwise infer from the extension so the object is not stored as
// application/octet-stream (browsers would download it instead of
// displaying it inline). Unknown extensions keep octet-stream.
// Shared by the simple-PUT, multipart-create and DAV PUT write paths.
export function resolveUploadContentType(declared, key) {
  const d = (declared || '').trim();
  const lower = d.toLowerCase();
  if (d
    && lower !== 'application/octet-stream'
    && !lower.startsWith('application/octet-stream;')) {
    return d;
  }
  return inferContentType(key) || 'application/octet-stream';
}

// Returns the video Content-Type for key when the stored type is
// unknown, or null when the stored type should be kept as-is.
export function normalizeVideoContentType(key, storedType) {
  const type = (storedType || '').trim();
  if (type && type !== 'application/octet-stream') return null;
  const dot = key.lastIndexOf('.');
  if (dot < 0) return null;
  return VIDEO_CONTENT_TYPES[key.slice(dot + 1).toLowerCase()] || null;
}
