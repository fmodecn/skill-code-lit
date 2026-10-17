/**
 * utils/router.js —— 基于 document.baseURI 的导航，尊重 <base href>。
 */
export function navigate(path, { replace = false } = {}) {
  const url = new URL(path, document.baseURI);
  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** 当前路径（去掉 base 前缀，供路由匹配） */
export function currentPath() {
  const base = new URL(document.baseURI).pathname.replace(/\/$/, '');
  return location.pathname.replace(base, '') || '/';
}
