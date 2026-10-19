/**
 * utils/router.js —— 子路径部署安全的导航（只用 History API，干净 URL）。
 *
 * ⚠️ 不要用 `new URL(path, document.baseURI)` 做导航：
 *   当 path 以 `/` 开头时，URL 的相对解析会**丢掉 base 的路径前缀**
 *   （`/hello-lit/students` → `https://cdn/students`），子路径部署下刷新即 404。
 *   正确做法：把应用内路径拼到 base 的 **pathname** 上再解析。
 */

/** base 路径（去尾斜杠），如 '/hello-lit'；根部署时为 '' */
export function basePath() {
  return new URL(document.baseURI).pathname.replace(/\/+$/, '');
}

/** 应用内路径（`/users` 这种）→ 保留部署前缀的绝对 URL（查询串 / hash 原样保留） */
export function resolveUrl(path) {
  const base = basePath();
  const q = path.indexOf('?');
  const h = path.indexOf('#');
  let cut = path.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  let p = path.slice(0, cut);
  const rest = path.slice(cut);            // ?query#hash 原样带过去
  if (!p.startsWith('/')) p = '/' + p;     // 容错：允许传 'users' 或 '/users'
  return new URL(base + p + rest, location.origin);
}

/** 跳转：pushState 后手动派发 popstate，让订阅者感知（History 原生不触发）。 */
export function navigate(path, { replace = false } = {}) {
  const url = resolveUrl(path);
  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** 当前路径：剥掉部署前缀，返回应用内路径（始终以 / 开头）。 */
export function currentPath() {
  const base = basePath();
  let path = location.pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length);
  if (!path.startsWith('/')) path = '/' + path;
  return path.replace(/\/{2,}/g, '/') || '/';   // 折叠 '//users'
}

/** 路径 → 查询参数对象 */
export function currentQuery() {
  return Object.fromEntries(new URLSearchParams(location.search));
}

/** 应用内绝对链接（供真实 <a href> 使用，保留「新标签打开」能力） */
export function href(path) {
  return resolveUrl(path);
}
