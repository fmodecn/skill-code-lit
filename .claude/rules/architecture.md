# 架构与分层

> 目标：零编译、零打包、纯原生 JS。基于浏览器原生 ESM + Import Map，依赖托管在内部 **FMODE Repose**，
> 业务代码直接上传 **OBS + CDN**，保存刷新即预览。对标新版 Angular（History 干净路由、DI、Signal 细粒度响应式、
> 组件/服务分层、后台多标签，**无 Zone.js**）。

## 一、整体架构

- **无构建无打包**：不用 rollup / esbuild / vite / webpack，源码浏览器直接执行。
- **依赖统一托管**：`lit`、`@lit-labs/*` 等从 npm 下 **原始 ESM** 原样同步到 **FMODE Repose**，全业务共享。
- **业务资源独立托管**：业务源码（`index.html`、`js` 组件）部署到 **OBS + CDN**。
- **分层（对标 Angular）**：
  - **WebComponent（`LitElement`）**：只渲染视图 + DOM 事件，不写复杂业务逻辑。
  - **Service（普通 ESM Class）**：存全局状态 / 接口 / 业务计算，与 DOM 解耦。
  - **Utils（纯 ESM 函数）**：无状态共享工具。
- **响应式**：`@lit-labs/signals`（细粒度信号）。
- **DI**：`@lit-labs/context`（组件树注入）。
- **路由**：自写 `utils/router.js`，History 干净 URL（支持微信 OAuth 回调，需 CDN 回退规则）。
  子路径部署**禁用** `@lit-labs/router`（全局 `<a>` 拦截 + 未剥前缀 pathname 会污染路由），见 [routing-best-practices.md](./routing-best-practices.md)。

### 一·五、双方向分层：core / wc / page（新增）

上面的「组件 / 服务 / 工具」讲的是**一个应用内部**怎么分。本仓还支持**跨应用复用**的两个方向，
二者是**同一套无构建铁律**在不同尺度上的应用：

```
┌─────────────────────────────────────────────────────────────────────┐
│ [page] 页面层   Lit 无构建页面（本应用）                              │
│   组合 <my-x> 与页内组件；路由 / 多标签 / 布局只在页面层              │
│      ▲ import                                                        │
│ [wc]   组件库   Web Component（仅浏览器交互：DOM / 事件 / Shadow DOM） │
│   一批 customElements；跨框架（Lit/Vue/React/原生）直接 <my-x> 使用   │
│      ▲ import                                                        │
│ [core] 核心库   纯 ESM 逻辑（零浏览器依赖，Node 可 import 单测）        │
│   纯函数 / 类 / 状态机；不 import Lit、不碰 window/document/fetch      │
└─────────────────────────────────────────────────────────────────────┘
```

| 层 | 产物 | 依赖 | 规则篇 |
|----|------|------|--------|
| **core** | npm ESM 包（可跑 Node） | 只依赖 `node:*` 与纯 JS 库（`@lit-labs/signals` 可用） | [core-library.md](./core-library.md) |
| **wc** | 一批自定义元素（浏览器） | `core` + `lit`（仅渲染 API） | [web-component-library.md](./web-component-library.md) |
| **page** | 一个应用的 `src/`（浏览器） | `wc` / `core` + 页面 `services/` `utils/` | [components.md](./components.md) |

**对应实例**：`fmode-code-agent` = **core**（逻辑层纯 ESM）；`designer-chat` 组件 = **wc**；
任意后台页 = **page**（组合 wc，并可只用页内组件而不用组件库）。

> 什么时候只需两层：只服务本项目、组件不复用 → **只有 page + 内联的 services/utils** 就够（最常见）。
> 一旦出现「换一个框架还想复用这段逻辑」→ 下沉为 **core**；「换一个框架还想复用这个 UI」→ 上提为 **wc**。
> 别为了分层而分层，但**一旦跨框架复用，core 必须零 DOM 依赖**，否则复用不成立。


## 二、分层职责表（越界即返工）

| 层 | 目录 | 允许 | 禁止 |
|----|------|------|------|
| 视图组件 | `components/` `routes/` | 渲染、DOM 事件、读 Signal、调 Service、`@property` 本地状态 | 大量业务逻辑、直接 `fetch`、硬编码接口地址、跨组件直接 new Service |
| 服务 | `services/` | 持有 Signal、封装接口、校验、数据转换、业务计算 | 依赖 DOM / `LitElement`、`import { html }` 创建 DOM |
| 工具 | `utils/` | 纯无状态函数、通用封装（http/storage/format） | 持有可变全局状态、依赖上面两层 |

> 判定口诀：**能被单测、不 import Lit 的，就不是组件**。服务必须能在 Node 里 `import` 后直接跑。

> 三分层版的口诀（见 [一·五](#一五分方向分层core--wc--page新增)）：
> **core 不认识 DOM，wc 不认识业务，page 组装一切。** service 若连 `localStorage` / `fetch` 都想抽走，就成 core；
> 若沾 DOM，就留在 page。

## 三、运行流程

```
浏览器打开 URL
  → CDN 回退规则：不存在的路径 200（非 302）返回 index.html
  → index.html 加载公共 importmap（指向 FMODE Repose）
  → 加载 app.js
  → import lit 依赖
  → 初始化 路由 / Store / 根组件渲染
```

## 四、部署拓扑（内网细节，勿外泄）

- **FMODE Repose**（静态依赖仓）：`/npm/lit/v3.x.x/`、`/npm/@lit-labs/{context,signals,router}/vx/`、`/npm/importmap/lit-v3.json`（公共 importmap）。
- **OBS + CDN**（业务托管）：`index.html`（引入 importmap）、`app.js`、`/routes/`、`/components/`、`/services/`、`/utils/`。

> ⚠️ 本仓为 **private**。上面是内部拓扑，对外文档/开源材料中只写「内部依赖仓 + OBS+CDN」即可，**不写域名、桶名、AK/SK、obsutil 路径**。

## 五、为什么这么选（对标 Angular zoneless）

| 维度 | 传统 Angular(Zone) | 本方案（Lit + Signals） |
|------|--------------------|--------------------------|
| 变更检测 | Zone.js 全局猴子补丁，全组件树 check | Signal 精确到依赖了该信号的组件 |
| 构建 | 必须 ng build | **无构建**，保存刷新即见 |
| 依赖 | 打包进 bundle | Repose 共享，一次上传全业务复用 |
| 路由 | 框架内置 | 原生 History，干净 URL，OAuth 友好 |
| 样式隔离 | ViewEncapsulation | Shadow DOM 原生隔离 |
| 心智负担 | 框架黑盒 | 原生 API，无魔法 |

详见 [../docs/retrospective.md](../../docs/retrospective.md)。

## 六、扩展方向

- 全局 HTTP 工具（token 拦截 / 错误处理统一）。
- 通用弹窗 / 表格 / 表单 WebComponent → 内部组件库，托管 FMODE Repose。
- 路由守卫鉴权。
- 全局 loading / 消息提示组件 + 全局 Signal 控制。
- **逻辑层抽成 core 库**（纯 ESM、零 DOM）→ 同一套逻辑喂给 Lit / Vue / React 多套 UI，见 [core-library.md](./core-library.md)。
- **组件库升级为跨框架分发**（wc 层）→ 非 Lit 宿主也能 `<my-x>`，见 [web-component-library.md](./web-component-library.md)。
