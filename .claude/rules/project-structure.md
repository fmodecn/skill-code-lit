# 项目目录规范

> 无打包 → `src/` 目录结构会**原样**上传到 OBS（不存在 tree-shaking / 文件重命名 / hash），
> 所以目录即 URL 路径，文件即模块。摆放必须克制、可预测。

## 一、标准目录

```
src/
  index.html            # 入口：<base> + <script type="importmap"> + <script type="module" src="./app.js">
  app.js                # 应用装配：全局 DI provide + 路由挂载 + 根组件渲染 + 多标签
  components/           # 通用组件（可跨页复用）
    side-menu.js
    user-card.js
    tabs-container.js
  routes/               # 页面级组件（一页一文件）
    page-user-list.js
    page-user-detail.js
    page-404.js
  services/             # 业务服务（状态 + 接口 + 计算）
    auth-service.js
    table-service.js
    router-service.js
  utils/                # 无状态工具
    http.js
    storage.js
    format.js
```

`examples/hello-lit/` 是本规范的完整可运行样例。

## 二、命名约定

| 类型 | 文件 | 类 / 导出 | 自定义元素标签 |
|------|------|-----------|----------------|
| 通用组件 | `kebab-case.js` | `PascalCase`（如 `UserCard`） | `kebab-case`（`<user-card>`，**必须含连字符**） |
| 页面组件 | `page-xxx.js` | `PageXxx` | `<page-xxx>` |
| 服务 | `xxx-service.js` | `XxxService` | 单例：`export const xxxService = new XxxService()` |
| 工具 | `xxx.js` | 具名导出纯函数 | — |

- 目录一律小写 kebab-case。
- 自定义元素标签**必须**包含短横线（HTML 规范，否则注册失败）。
- 一个文件一个默认/具名导出的组件类，文件名与标签对应。

## 三、为什么要「目录即路径」

无构建下浏览器按 URL 解析相对 import：

```js
// 在 /projects/admin/routes/page-user-list.js 中
import { authService } from '../services/auth-service.js';  // → /projects/admin/services/auth-service.js
```

因此：
- **相对导入必须带 `.js` 后缀**（浏览器原生 ESM，不做扩展名补全）。❌ `import x from './foo'`
- 移动文件 = 改 URL，改文件必须同步改所有引用。
- 不要深层嵌套（超过 3 层）——ESM 小文件多，路径越长越啰嗦。

## 四、二级子路径部署

子目录部署（如 `/projects/admin/`）时，**必须在 `index.html` 的 `<head>` 写 `<base href>`**：

```html
<base href="/<project>/"><!-- 例：/admin/ 或 /dev/fmode-app/ -->
```

否则浏览器会把 `./app.js` 解析到域名根，相对 JS 全部 **404**。

- `<base>` 影响：所有**相对 URL**（`href`/`src`/`fetch` 相对路径/`import` 裸相对路径）。
- 路由若用 History API 生成链接，需基于 `base` 或应用前缀拼装，见 [routing.md](./routing.md)。
- 切换部署路径只需改这一处 `<base href>` + importmap 里的业务前缀（若有）。

## 五、依赖不进业务仓

- **禁止**在业务仓 `node_modules` 里放 `lit` 供运行时 `import`。
- **禁止**把 `lit` 源码拷进 `src/`。
- 运行时依赖全部由 `index.html` 的 importmap 指向 **FMODE Repose** 解析，见 [deployment.md](./deployment.md)。
- 本地 `npm install lit @lit-labs/*` **仅**用于 IDE/TS 类型提示，**不参与产物**。

```jsonc
// package.json —— 仅开发期类型提示，不打包
{
  "private": true,
  "devDependencies": { "lit": "^3.2.0", "@lit-labs/signals": "^0.1.0" },
  "scripts": { "deploy": "bash scripts/deploy.sh" }
}
```

## 六、文件摆放决策表

| 这个东西是… | 放哪 |
|-------------|------|
| 全站复用的 UI（菜单、卡片、弹层） | `components/` |
| 一个路由对应的一整页 | `routes/page-*.js` |
| 有状态、要跨页共享的业务逻辑 | `services/*-service.js` |
| 无状态、纯计算的函数 | `utils/` |
| 全局装配（DI、路由、根标签） | `app.js` |
| 第三方运行时依赖 | **不放项目里**，走 Repose + importmap |
