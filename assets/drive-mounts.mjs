// FlarePan Google Drive 挂载：前端本地模块（v1 只读）。
//
// 只依赖浏览器内置 API；配置只存在 localStorage（键 pan-drive-mounts），
// refresh_token 只存在该记录里，access_token 只放内存（本模块的 Map），
// 绝不写进任何服务端存储。换 token 必须走 Worker（/api/drive-oauth），
// 浏览器永远不接触 Client Secret（见 DESIGN.md §0.2）。
// 本模块全部是纯函数（除 load/save 与内存 token 外），方便在 Node 里单测。
//
// 开发期开关：URL 带 ?driveMock=1 时，Drive API base 换成本地 stub
// （window.__DRIVE_MOCK_BASE__ 或 '/drive-mock'），access_token 用
// 固定假值，不走真实 Google。生产环境没有该参数时永不触发。

export const DRIVE_MOUNTS_KEY = 'pan-drive-mounts';
export const DRIVE_ACTIVE_KEY = 'pan-drive-active';
export const DRIVE_OAUTH_PENDING_KEY = 'pan-drive-oauth-pending';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const DRIVE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// ---------------------------------------------------------------------------
// base64url（UTF-8 安全）与随机串。
// ---------------------------------------------------------------------------

export function base64UrlEncodeBytes(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomBase64Url(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncodeBytes(bytes);
}

// ---------------------------------------------------------------------------
// PKCE（Authorization Code + S256）。
// ---------------------------------------------------------------------------

// code_verifier：43–128 个 base64url 字符（32 字节随机 → 43 字符）。
export function generateCodeVerifier() {
  return randomBase64Url(32);
}

// code_challenge = base64url(SHA-256(verifier))。
export async function generateCodeChallenge(verifier) {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

// state：防 CSRF 的随机串，授权回调时校验。
export function generateState() {
  return randomBase64Url(24);
}

// ---------------------------------------------------------------------------
// 授权 URL 与 token 响应解析。
// ---------------------------------------------------------------------------

// 授权 URL：redirect_uri 取调用方传入（生产/预览域名各自的 origin + '/'）。
// access_type=offline 拿 refresh_token；prompt=consent 保证每次都发新的。
export function buildAuthUrl({ clientId, redirectUri, codeChallenge, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  return DRIVE_AUTH_URL + '?' + params.toString();
}

// token 响应（Google 的 snake_case）→ 驼峰 + expiresAt（提前 60 秒算过期）。
// refresh_token 可能缺失（再次授权不带 prompt=consent 时）：缺失即 undefined。
export function parseTokenResponse(json) {
  const data = json || {};
  const expiresIn = Number(data.expires_in) || 0;
  return {
    accessToken: data.access_token || '',
    expiresIn,
    refreshToken: data.refresh_token || undefined,
    scope: data.scope || '',
    tokenType: data.token_type || 'Bearer',
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 - 60000 : 0,
  };
}

// ---------------------------------------------------------------------------
// 本地存储：挂载列表（localStorage）、当前 Drive 位置与授权暂存（sessionStorage）。
// ---------------------------------------------------------------------------

export function loadDriveMounts() {
  try {
    const raw = localStorage.getItem(DRIVE_MOUNTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // clientId 不再存进挂载记录（OAuth 配置改由服务端管理）；
    // 旧记录自带的 clientId 直接忽略，不影响加载。
    return list.filter((m) => m && typeof m.id === 'string');
  } catch (e) {
    return [];
  }
}

export function saveDriveMounts(mounts) {
  try {
    localStorage.setItem(DRIVE_MOUNTS_KEY, JSON.stringify(mounts));
    return true;
  } catch (e) {
    return false;
  }
}

export function newDriveMountId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'g-' + crypto.randomUUID();
  }
  return 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Drive 挂载对象：{ id, type: 'drive', name, accountEmail,
//   accountName, accountPhoto, refreshToken, scope, createdAt,
//   lastCheckedAt, lastStatus }。clientId 不再存进挂载记录（OAuth
//   配置改由服务端管理，Worker 换 token 时读 D1 配置）。
export function normalizeDriveMount(input) {
  return {
    id: input.id || newDriveMountId(),
    type: 'drive',
    name: String(input.name || '') || 'Google Drive',
    accountEmail: String(input.accountEmail || ''),
    accountName: String(input.accountName || ''),
    accountPhoto: String(input.accountPhoto || ''),
    refreshToken: String(input.refreshToken || ''),
    scope: String(input.scope || '') || DRIVE_SCOPE,
    createdAt: input.createdAt || Date.now(),
    lastCheckedAt: input.lastCheckedAt || 0,
    lastStatus: input.lastStatus || '',
  };
}

// 当前 Drive 位置：{ mountId, folderId, crumbs: [{ id, name }] }。
export function loadDriveActiveRef() {
  try {
    const raw = sessionStorage.getItem(DRIVE_ACTIVE_KEY);
    if (!raw) return null;
    const ref = JSON.parse(raw);
    if (!ref || typeof ref.mountId !== 'string') return null;
    return ref;
  } catch (e) {
    return null;
  }
}

export function saveDriveActiveRef(mountId, folderId, crumbs) {
  try {
    sessionStorage.setItem(
      DRIVE_ACTIVE_KEY,
      JSON.stringify({
        mountId,
        folderId: folderId || 'root',
        crumbs: Array.isArray(crumbs) ? crumbs : [],
      })
    );
  } catch (e) {}
}

export function clearDriveActiveRef() {
  try {
    sessionStorage.removeItem(DRIVE_ACTIVE_KEY);
  } catch (e) {}
}

// 授权暂存（PKCE verifier + state + 表单信息）：只活本次授权，完成后即删。
export function saveOAuthPending(pending) {
  try {
    sessionStorage.setItem(DRIVE_OAUTH_PENDING_KEY, JSON.stringify(pending));
  } catch (e) {}
}

export function loadOAuthPending() {
  try {
    const raw = sessionStorage.getItem(DRIVE_OAUTH_PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.state !== 'string') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearOAuthPending() {
  try {
    sessionStorage.removeItem(DRIVE_OAUTH_PENDING_KEY);
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Drive API base（开发期 mock 开关）与内存 access_token。
// ---------------------------------------------------------------------------

// ?driveMock=1 时把 API base 换成本地 stub；其余情况一律走真实 Google。
export function driveApiBase() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('driveMock') === '1') {
      if (typeof window !== 'undefined' && window.__DRIVE_MOCK_BASE__) {
        return String(window.__DRIVE_MOCK_BASE__);
      }
      return '/drive-mock';
    }
  } catch (e) {}
  return DRIVE_API_BASE;
}

export function isDriveMock() {
  try {
    return new URLSearchParams(location.search).get('driveMock') === '1';
  } catch (e) {
    return false;
  }
}

// access_token 只放内存（Map<mountId, { token, expiresAt }>），页面刷新即丢。
const tokenStore = new Map();
// 进行中的刷新（Map<mountId, Promise>）：同一时刻只发一次刷新请求，
// 并发的列表/预览共享一次结果（见 DESIGN.md §4.3）。
const refreshInflight = new Map();

export function setAccessToken(mountId, token, expiresIn) {
  const expiresAt =
    expiresIn > 0 ? Date.now() + expiresIn * 1000 - 60000 : 0;
  tokenStore.set(mountId, { token, expiresAt });
}

export function getStoredAccessToken(mountId) {
  const entry = tokenStore.get(mountId);
  if (!entry || !entry.token) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) return null;
  return entry.token;
}

export function clearAccessToken(mountId) {
  tokenStore.delete(mountId);
  refreshInflight.delete(mountId);
}

// ---------------------------------------------------------------------------
// Worker 换 token（浏览器永远不接触 Client Secret）。
// ---------------------------------------------------------------------------

// 换 token 失败时抛错，err.code 为 Google 的 error（如 invalid_grant、
// invalid_client）或 'server_misconfigured'（服务端未配 OAuth）。
// Client ID / Secret / 重定向 URI 由 Worker 读 D1 配置，前端不再传。
export async function exchangeCode({ code, codeVerifier, redirectUri }) {
  const res = await fetch('/api/drive-oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'exchange',
      code,
      codeVerifier,
      redirectUri,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const err = new Error(data.error_description || data.error || 'exchange_failed');
    err.code = data.error || 'exchange_failed';
    err.status = res.status;
    throw err;
  }
  return parseTokenResponse(data);
}

export async function refreshAccessToken(mount) {
  if (!mount || !mount.refreshToken) {
    const err = new Error('no refresh token');
    err.code = 'no_refresh_token';
    throw err;
  }
  const existing = refreshInflight.get(mount.id);
  if (existing) return existing;
  const task = (async () => {
    // mock 模式下不调 Worker，直接给假 token（测试用）。
    if (isDriveMock()) {
      const fake = { accessToken: 'mock-token', expiresIn: 3600, expiresAt: Date.now() + 3540000 };
      tokenStore.set(mount.id, { token: fake.accessToken, expiresAt: fake.expiresAt });
      return fake.accessToken;
    }
    const res = await fetch('/api/drive-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh',
        refreshToken: mount.refreshToken,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const err = new Error(data.error_description || data.error || 'refresh_failed');
      err.code = data.error || 'refresh_failed';
      err.status = res.status;
      throw err;
    }
    const parsed = parseTokenResponse(data);
    tokenStore.set(mount.id, { token: parsed.accessToken, expiresAt: parsed.expiresAt });
    return parsed.accessToken;
  })();
  refreshInflight.set(mount.id, task);
  try {
    return await task;
  } finally {
    refreshInflight.delete(mount.id);
  }
}

// 拿可用的 access_token：内存里有且未过期直接用，否则静默刷新一次。
export async function getAccessToken(mount) {
  if (isDriveMock()) return 'mock-token';
  const cached = getStoredAccessToken(mount.id);
  if (cached) return cached;
  return refreshAccessToken(mount);
}

// 服务器 Secret 配置状态（只报配没配，不返回值）。
export async function getDriveOAuthStatus() {
  const res = await fetch('/api/drive-oauth?status=1');
  const data = await res.json().catch(() => ({}));
  return { configured: !!data.configured };
}

// 管理员已配置且已启用的挂载提供商（公开值，不含 Secret）。
// 前端据此决定「添加挂载」里显示哪些第三方网盘入口。
// 失败时返回空列表（前端隐藏全部第三方入口，不挡路）。
export async function getMountProviders() {
  try {
    const res = await fetch('/api/mounts/providers');
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data.providers) ? data.providers : [];
    return list.filter(
      (p) => p && typeof p.id === 'string' && typeof p.client_id === 'string'
    );
  } catch (e) {
    return [];
  }
}

// 吊销 refresh_token（revoke 不需要 secret，可浏览器直发）。
// 失败返回 false，不阻塞删除挂载。
export async function revokeDriveToken(refreshToken) {
  if (!refreshToken) return false;
  try {
    const res = await fetch(DRIVE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }).toString(),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Drive API 调用（浏览器直发 Bearer；401 时刷新一次再重试）。
// ---------------------------------------------------------------------------

export async function driveFetch(mount, path, options) {
  const opts = options || {};
  const base = driveApiBase();
  const url = base + path;
  const doFetch = async (token) =>
    fetch(url, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + token },
      signal: opts.signal,
    });
  let token = await getAccessToken(mount);
  let res = await doFetch(token);
  if (res.status === 401 && !opts._retried) {
    // access_token 过期：静默刷新一次再重试原请求（见 DESIGN.md §4.3）。
    clearAccessToken(mount.id);
    token = await refreshAccessToken(mount);
    res = await doFetch(token);
  }
  return res;
}

// drive.about.get：只取账号名/邮箱/头像（挂载测试与建挂载用）。
export function parseAbout(json) {
  const user = (json && json.user) || {};
  return {
    accountName: user.displayName || '',
    accountEmail: user.emailAddress || '',
    accountPhoto: user.photoLink || '',
  };
}

export async function fetchDriveAbout(mount) {
  const res = await driveFetch(mount, '/about?fields=user(displayName,emailAddress,photoLink)');
  if (!res.ok) {
    const err = new Error('about_failed');
    err.status = res.status;
    throw err;
  }
  return parseAbout(await res.json());
}

// files.list：只列“我的云端硬盘”（spaces=drive），回收站排除。
export async function fetchDriveFiles(mount, folderId, pageToken) {
  const parent = folderId || 'root';
  const q = "'" + parent + "' in parents and trashed = false";
  const params = new URLSearchParams({
    q,
    fields:
      'nextPageToken,files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,parents,shortcutDetails)',
    pageSize: '100',
    orderBy: 'folder,name',
    spaces: 'drive',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const res = await driveFetch(mount, '/files?' + params.toString());
  if (!res.ok) {
    const err = new Error('list_failed');
    err.status = res.status;
    let detail = null;
    try {
      detail = await res.json();
    } catch (e) {}
    if (detail && detail.error) err.driveError = detail.error;
    throw err;
  }
  return normalizeDriveList(await res.json(), parent);
}

// ---------------------------------------------------------------------------
// 列表归一化（§6.2）：Drive 字段 → 现有列表形状 { value, folders }。
// ---------------------------------------------------------------------------

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

// 原生 Google 文档 mimeType 前缀。
export function isNativeGoogleMime(mimeType) {
  return String(mimeType || '').startsWith('application/vnd.google-apps.');
}

export function isDriveFolder(mimeType) {
  return mimeType === DRIVE_FOLDER_MIME;
}

// 快捷方式解析一层：返回目标 { id, mimeType }，解析失败返回 null。
export function resolveDriveShortcut(file) {
  const details = file && file.shortcutDetails;
  if (!details || !details.targetId) return null;
  return { id: details.targetId, mimeType: details.targetMimeType || '' };
}

function normalizeDriveFile(file) {
  const mimeType = file.mimeType || '';
  const size = file.size !== undefined && file.size !== null ? Number(file.size) : undefined;
  const item = {
    key: file.id,
    name: file.name || '',
    size: Number.isFinite(size) ? size : undefined,
    uploaded: file.modifiedTime || '',
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      webViewLink: file.webViewLink || '',
      thumbnailLink: file.thumbnailLink || '',
      iconLink: file.iconLink || '',
    },
    isFolder: mimeType === DRIVE_FOLDER_MIME,
    driveMimeType: mimeType,
    driveId: file.id,
  };
  // 快捷方式：解析目标后当目标类型渲染（只一层，不递归跟链）。
  if (mimeType === DRIVE_SHORTCUT_MIME) {
    const target = resolveDriveShortcut(file);
    if (target) {
      item.shortcutTargetId = target.id;
      item.shortcutTargetMimeType = target.mimeType;
      item.isFolder = target.mimeType === DRIVE_FOLDER_MIME;
      item.httpMetadata.contentType = target.mimeType || mimeType;
      item.driveMimeType = target.mimeType || mimeType;
    }
  }
  return item;
}

export function normalizeDriveList(json, folderId) {
  const data = json || {};
  const files = Array.isArray(data.files) ? data.files : [];
  const value = [];
  const folders = [];
  for (const file of files) {
    if (!file || !file.id) continue;
    const item = normalizeDriveFile(file);
    if (item.isFolder) {
      // 文件夹进 folders（{ id, name } 对象，没有路径字符串）。
      folders.push({ id: item.key, name: item.name });
    } else {
      value.push(item);
    }
  }
  return {
    value,
    folders,
    nextPageToken: data.nextPageToken || '',
    folderId: folderId || 'root',
  };
}

// ---------------------------------------------------------------------------
// 原生 MIME → 导出目标（§6.3）与图标。
// ---------------------------------------------------------------------------

// 原生文档导出目标 MIME；不能导出的返回 null（走信息卡 + webViewLink）。
export function driveExportMime(mimeType) {
  switch (mimeType) {
    case 'application/vnd.google-apps.document':
      return 'application/pdf';
    case 'application/vnd.google-apps.spreadsheet':
      return 'application/pdf';
    case 'application/vnd.google-apps.presentation':
      return 'application/pdf';
    case 'application/vnd.google-apps.drawing':
      return 'image/png';
    default:
      return null;
  }
}

// 原生类型图标（mimeType 优先；返回 null 时由 MimeIcon 按扩展名兜底）。
export function driveMimeIcon(mimeType) {
  switch (mimeType) {
    case 'application/vnd.google-apps.folder':
      return '📁';
    case 'application/vnd.google-apps.document':
      return '📄';
    case 'application/vnd.google-apps.spreadsheet':
      return '📊';
    case 'application/vnd.google-apps.presentation':
      return '📽️';
    case 'application/vnd.google-apps.drawing':
      return '🎨';
    case 'application/vnd.google-apps.form':
      return '📝';
    case 'application/vnd.google-apps.shortcut':
      return '🔗';
    default:
      return null;
  }
}

// 内容 URL（走同源内容代理 /api/drive-proxy；原生文档加 export 参数）。
export function driveFileUrl(fileId, exportMime) {
  let url = '/api/drive-proxy?f=' + encodeURIComponent(fileId);
  if (exportMime) url += '&export=' + encodeURIComponent(exportMime);
  return url;
}

// 媒体元素 src（带短命 access_token 的查询参数；refresh_token 永不进 URL）。
export function driveMediaUrl(fileId, accessToken, exportMime) {
  let url = driveFileUrl(fileId, exportMime);
  if (accessToken) url += '&t=' + encodeURIComponent(accessToken);
  return url;
}
