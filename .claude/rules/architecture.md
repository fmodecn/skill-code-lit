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
- **路由**：`@lit-labs/router`，History 干净 URL（支持微信 OAuth 回调，需 CDN 回退规则）。

## 二、分层职责表（越界即返工）

| 层 | 目录 | 允许 | 禁止 |
|----|------|------|------|
| 视图组件 | `components/` `routes/` | 渲染、DOM 事件、读 Signal、调 Service、`@property` 本地状态 | 大量业务逻辑、直接 `fetch`、硬编码接口地址、跨组件直接 new Service |
| 服务 | `services/` | 持有 Signal、封装接口、校验、数据转换、业务计算 | 依赖 DOM / `LitElement`、`import { html }` 创建 DOM |
| 工具 | `utils/` | 纯无状态函数、通用封装（http/storage/format） | 持有可变全局状态、依赖上面两层 |

> 判定口诀：**能被单测、不 import Lit 的，就不是组件**。服务必须能在 Node 里 `import` 后直接跑。

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
