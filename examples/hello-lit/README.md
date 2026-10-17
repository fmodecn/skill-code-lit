# hello-lit —— 无构建 Lit 示例

最小可运行的多标签后台示例，**零构建 / 零打包**，源码即产物。

## 目录

```
src/
  index.html              # <base> + importmap + 入口
  importmap.json          # 本地开发的 importmap（生产用 Repose 公共 importmap）
  app.js                  # 装配：provide + 根组件
  components/             # 通用 UI
    app-shell.js          # 布局壳（菜单 + 标签 + KeepAlive 内容）
    side-menu.js
    tabs-bar.js           # 多标签栏
    tabs-container.js     # KeepAlive 容器
    page-view.js          # 按 path 渲染页面
  modules/                # 功能模块
    home/page-home.js
    user/page-user-list.js
    user/page-user-detail.js
    user/user-service.js
    auth/auth-service.js
    page-404.js
  services/               # 跨模块共享
    contexts.js           # 注入令牌
    tabs-service.js       # 多标签状态（signal）
  utils/                  # 无状态工具
    http.js
    router.js
    format.js
```

## 本地运行（两种方式）

**方式 A：指向 Repose（需内网可达）**
`index.html` 里用 `<script type="importmap" src="/npm/importmap/lit-v3.json">`。起个静态服务器即可：

```bash
npx --yes serve src
# 浏览器打开 http://localhost:3000/hello-lit/   （注意 <base href="/hello-lit/">）
```

**方式 B：本地依赖（离线）**

```bash
cd examples/hello-lit
npm install lit @lit-labs/signals @lit-labs/context @lit-labs/router
# 把 index.html 的 importmap 换成 ./importmap.json，
# 并把 importmap.json 的路径指向 ./node_modules/...
npx serve src
```

> ⚠️ 本地开发注意：`<base href="/hello-lit/">` 要求站点根下有 `/hello-lit/` 前缀。
> 若直接在 `src/` 根起服务，可把 `<base href>` 临时改为 `./` 并把 index.html 的
> importmap 换成 `./importmap.json`（相对路径，无需前缀）。

## 演示点

- **无构建**：直接改 `src/` 下任意 `.js`，刷新即见。
- **分层**：`page-user-list` 只读 `userService.users`（signal）+ 转发点击；逻辑在 service。
- **Signal 响应式**：`SignalWatcher` 组件读 signal 自动重渲染。
- **Context**：`app.js` 用 `provide(authContext, authService)`；`page-home` 用 `ContextConsumer` 消费。
- **History 路由**：`navigate()` 基于 `document.baseURI`，干净 URL。
- **多标签 KeepAlive**：切到「用户列表」输入筛选词 → 去详情 → 切回，输入**不丢**（实例常驻）。
- **无装饰器**：全部用 `static properties` + `customElements.define()`。

## 部署

见 [../../.claude/rules/deployment.md](../../.claude/rules/deployment.md) 与 `deploy.sh`。
