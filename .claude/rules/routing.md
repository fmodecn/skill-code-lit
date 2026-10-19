# 路由（History 干净 URL）

> 使用 History 模式得到**干净 URL**（无 `#`）。这是内部后台 + 微信 OAuth 回调的硬性前提：
> OAuth 回调 URL 不能带 hash，且必须由 CDN 返回 **200**（不能 302）。
>
> ⚠️ **子路径部署（`/<env>/<project>/`）优先自写 `utils/router.js`，不要用 `@lit-labs/router`**：
> 它装全局 `<a>` click 拦截器，且用**未剥前缀**的 `location.pathname` 匹配路由，会污染路由状态。
> 根部署可选用它；子路径部署一律自写 —— 最小实现与完整踩坑见
> [routing-best-practices.md](./routing-best-practices.md)（坑 1、坑 2）。

## 〇、子路径部署的红线（先看这条）

应用内部只认「**不含前缀的应用内路径**」（`/students/s01`），前缀只在三处出现且必须同源：
`<base href>` == OBS 上传前缀 == importmap 路径前缀。

- ❌ **禁止** `new URL(path, document.baseURI)` 做导航 —— 当 `path` 以 `/` 开头时
  会**丢掉 base 的路径前缀**，刷新即 404。正确做法：拼到 base 的 **pathname** 上再解析。
- `currentPath()` 要**剥掉前缀**并折叠重复斜杠，脏 URL 兜底到 404 页。

完整根因与规避见 [routing-best-practices.md](./routing-best-practices.md)。

## 一、基本用法（@lit-labs/router，仅根部署）

```js
// services/router-service.js 或 app.js
import { Router } from '@lit-labs/router';

export function createRouter(host, routes) {
  return new Router(host, {
    routes: [
      { path: '/', render: () => html`<page-home></page-home>` },
      { path: '/users', render: () => html`<page-user-list></page-user-list>` },
      { path: '/users/:id', render: ({ id }) => html`<page-user-detail .userId=${id}></page-user-detail>` },
      { path: '/*', render: () => html`<page-404></page-404>` },
    ],
  });
}
```

在根组件里挂载：

```js
import { Router } from '@lit-labs/router';

export class AppShell extends LitElement {
  #router = new Router(this, [
    { path: '/', render: () => html`<page-home></page-home>` },
    { path: '/users', render: () => html`<page-user-list></page-user-list>` },
    { path: '/*', render: () => html`<page-404></page-404>` },
  ]);

  render() {
    return html`
      <side-menu></side-menu>
      <main>${this.#router.outlet()}</main>
    `;
  }
}
```

- `path` 支持参数段 `:id` 与通配 `/*`。
- `render(params)` 返回模板；参数从 `params` 取。
- `outlet()` 是渲染出口。

## 二、导航（干净 URL）

```js
import { navigate } from './router-utils.js';

navigate('/users/42');          // pushState
navigate('/login', { replace: true });
```

`utils/router.js` 里封装，**把应用内路径拼到 base 的 pathname 上**（不能用
`new URL(path, document.baseURI)`，会丢前缀）：

```js
export function basePath() {
  return new URL(document.baseURI).pathname.replace(/\/+$/, '');   // '/dev/myapp' 或 ''
}
export function resolveUrl(path) {
  const base = basePath();
  const q = path.indexOf('?'), h = path.indexOf('#');
  let cut = path.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  let p = path.slice(0, cut);
  const rest = path.slice(cut);              // 查询串 / hash 原样保留
  if (!p.startsWith('/')) p = '/' + p;
  return new URL(base + p + rest, location.origin);
}
export function navigate(path, { replace = false } = {}) {
  const url = resolveUrl(path);
  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
```

- **拼到 base 的 pathname 上**再解析，子目录部署（`/admin/`）才不会丢前缀。
- 手动 `pushState` 后派发 `popstate`，让订阅者感知（History 原生不触发）。
- 真链接用 `href(path)`（= `resolveUrl`）供 `<a href>` 使用，保留中键「新标签打开」。
- 完整实现与坑见 [routing-best-practices.md](./routing-best-practices.md)。

## 三、CDN 回退规则（History 路由的前提）

History 模式下，用户在 `/users/42` 直接刷新 → 该路径在 OBS 上不存在 → **必须由 CDN 回退规则**处理：

| 规则 | 行为 |
|------|------|
| 规则 1 | 路径命中真实静态资源（`.js` / `.css` / `.png` …）→ 直接返回 |
| 规则 2 | 路径不存在 → 返回 `index.html`，**状态码 200**，**禁止 301/302** |

> ⚠️ 若用 302 重定向到 `/index.html`，浏览器地址栏会被改写、`location.pathname` 丢失，路由参数全丢，微信 OAuth 回调也会失败。**必须 200**。

配置见 [deployment.md](./deployment.md)。

## 四、路由守卫（鉴权）

```js
const requireAuth = (render) => (params) => {
  if (!authService.isLoggedIn.get()) {
    navigate('/login');
    return html``;   // 或渲染登录页占位
  }
  return render(params);
};

new Router(this, [
  { path: '/users', render: requireAuth((p) => html`<page-user-list></page-user-list>`) },
]);
```

- 守卫是**纯函数包装**，不引入框架概念。
- 异步守卫（先校验 token 再放行）可返回 Promise 模板，或先渲染 loading。

## 五、OAuth 回调（微信）

- 回调地址设为业务前缀下的干净路径，如 `https://<cdn-domain>/<project>/oauth/callback`。
- 该路径在 CDN 上不存在 → 由回退规则 200 返回 `index.html` → 前端读取 `location.search` 里的 `code`。
- **全程不能出现 302**，否则微信校验的 `redirect_uri` 与实际落地 URL 不一致。

## 六、多标签的交互

若应用是多标签后台（见 [tabs-keepalive.md](./tabs-keepalive.md)），路由切换需驱动「打开/激活标签」而非整体重渲染：

```js
// Router 命中新路径时 → tabsService.open(path, { title, component })
// 已存在同 path 标签 → 仅激活；不存在 → 新开
```

## 七、坑

- 忘记 CDN 回退 → 刷新 404。回退**必须 200**，禁 301/302（302 会丢 `pathname`）。
- `<base href>` 配错 / 与部署前缀不一致 → 相对 import 404。
- `new URL(path, document.baseURI)` 丢部署前缀 → 子路径深链接 404（**最高频**，见坑 1）。
- `@lit-labs/router` 在子路径部署下污染路由状态（全局 `<a>` 拦截 + 未剥前缀 pathname）。
- 用 `<a href="/x">` 原生跳转 → 整页刷新（非 SPA）。内部导航一律 `navigate()` + `popstate`；
  要保留「新标签打开」的用 `href()`。
- 只 `curl` 首页 200 就算验收 → 用户白屏。**必须**跑模块图爬取 + 真实浏览器。
- 混用 hash 路由与 History 路由 → 混乱。**只用 History**。

> 以上每条的**症状 → 根因 → 规避**，逐条见 [routing-best-practices.md](./routing-best-practices.md)。
