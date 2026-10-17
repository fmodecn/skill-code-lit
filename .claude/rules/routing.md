# 路由（@lit-labs/router）

> 使用 History 模式得到**干净 URL**（无 `#`）。这是内部后台 + 微信 OAuth 回调的硬性前提：
> OAuth 回调 URL 不能带 hash，且必须由 CDN 返回 **200**（不能 302）。

## 一、基本用法

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

`utils/router.js` 里封装，基于 `<base href>` 拼前缀：

```js
export function navigate(path, { replace = false } = {}) {
  const url = new URL(path, document.baseURI); // 尊重 <base href>
  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
```

- **基于 `document.baseURI`** 拼 URL，子目录部署（`/admin/`）才不会跳错。
- 手动 `pushState` 后派发 `popstate`，让 Router 感知。

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

- 忘记 CDN 回退 → 刷新 404。
- `<base href>` 配错 → 相对 import 404。
- 用 `<a href="/x">` 原生跳转 → 整页刷新（非 SPA）。内部导航一律 `navigate()` + `popstate`。
- 混用 hash 路由与 History 路由 → 混乱。**只用 History**。
