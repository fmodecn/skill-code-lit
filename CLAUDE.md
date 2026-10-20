# fmode-code-lit — Lit 原生 ESM 无构建开发规则总纲

> 本文件是 AI（Claude Code / FmodeCode）在本仓、或引用本仓规则时的**第一入口**。
> 写任何 Lit 前端代码前，先读本文件，再按下表索引到具体规则篇。
> 源稿：`.claude/_lit-dev-manual.md`（用户提供的《Lit 原生 ESM 无构建开发最佳实践》）。

## 0. 三条铁律（违反即返工）

1. **源码即产物**：不引入任何构建/打包器（rollup / esbuild / vite / webpack）。写好的 `.js` 直接上传 OBS，浏览器原生 ESM 执行。
2. **依赖不落地项目**：`lit`、`@lit-labs/*` 等运行时依赖一律从 **FMODE Repose** 公共 importmap 引入，**禁止**把依赖源码拷进业务仓、禁止业务仓 `import` 裸 `node_modules`。
3. **分层不可越界**：组件（渲染）→ 服务（业务与状态）→ 工具（无状态函数）。组件禁止直接 `fetch`、禁止写复杂业务逻辑；服务禁止触碰 DOM。
   > 跨项目复用时升一级为三分层：**core**（纯 ESM，零 DOM）→ **wc**（Web Component，零业务）→ **page**（组装）。见 [§2.1](#21-分层一句话core--wc--page)。

## 1. 规则索引

| # | 规则篇 | 内容 | 何时读 |
|---|--------|------|--------|
| 1 | [architecture.md](./.claude/rules/architecture.md) | 整体架构、分层职责、运行流程、部署拓扑 | 起项目 / 定架构 |
| 2 | [project-structure.md](./.claude/rules/project-structure.md) | 目录规范、命名、文件摆放、二级路径 base | 建目录 / 放文件 |
| 3 | [components.md](./.claude/rules/components.md) | LitElement 组件规范、Shadow DOM、属性/事件、Slot | 写组件 |
| 4 | [services.md](./.claude/rules/services.md) | Service 分层、Signal 状态、单例、可单测 | 写服务 / 状态 |
| 5 | [context-di.md](./.claude/rules/context-di.md) | `@lit-labs/context` 令牌与 provide/consume | 做依赖注入 |
| 6 | [routing.md](./.claude/rules/routing.md) | History 路由、守卫、404（子路径部署自写 `utils/router.js`） | 做路由 |
| 7 | [tabs-keepalive.md](./.claude/rules/tabs-keepalive.md) | 后台多标签 + KeepAlive（实例常驻） | 做后台壳 |
| 8 | [http-utils.md](./.claude/rules/http-utils.md) | 原生 Fetch 封装、token 拦截、错误处理、utils | 写请求 / 工具 |
| 9 | [deployment.md](./.claude/rules/deployment.md) | FMODE Repose 依赖托管 + OBS+CDN 业务部署 + importmap | 上线 / 配依赖 |
| 10 | [pitfalls.md](./.claude/rules/pitfalls.md) | CORS / 版本冲突 / 302 陷阱 / base href 等坑位 | 排查问题 |
| 11 | [modules/](./.claude/rules/modules/) | 功能模块 / 通用能力 / 业务模块 划分最佳实践 | 模块拆分 |
| 12 | [routing-best-practices.md](./.claude/rules/routing-best-practices.md) | **子路径部署路由实战**：base 三处同源 / `new URL` 丢前缀 / 弃用 `@lit-labs/router` / CDN 刷新假成功 / 验收不能只 curl | 做路由 / 子路径部署 / 上线验收 |
| 13 | [core-library.md](./.claude/rules/core-library.md) | **核心库（core）**：纯 ESM 零浏览器依赖、只 export 纯逻辑、Node 可测、无构建打包为单文件、版本管理 | 抽逻辑层 / 跨框架复用 / 写库 |
| 14 | [web-component-library.md](./.claude/rules/web-component-library.md) | **组件库（wc）**：customElements 注册、属性/事件/Slot/`::part`、跨框架用法、依赖 core、样式隔离、无装饰器 | 写 Web Component / 组件跨框架复用 |
| 15 | [retrospective.md](./docs/retrospective.md) | 对标 Angular zoneless 的技术复盘 | 理解选型理由 |

## 2. 架构一句话

浏览器打开 URL → CDN 回退规则把不存在的路径 **200（非 302）** 返回 `index.html` → `index.html` 加载 **公共 importmap**（指向 FMODE Repose）→ 加载 `app.js` → `import` lit 依赖 → 初始化 Store / 路由 / 根组件 → 渲染。全程**零编译**。

## 2.1 分层一句话（core / wc / page）

```
[core] 纯 ESM 逻辑库    不认识 DOM / Lit，Node 可 import 单测
   ▲ import
[wc]   Web Component 组件库  认识 DOM，不认识业务；跨框架 <my-x> 直接用
   ▲ import
[page] Lit 无构建页面    组装 core 与 wc，持有路由 / 布局 / 服务
```

**core 不认识 DOM，wc 不认识业务，page 组装一切。** 换框架还想复用逻辑 → 下沉 core；
换框架还想复用 UI → 上提 wc；只服务本项目 → 停在 page。
（`fmode-code-agent` = core；`designer-chat` 组件 = wc；后台页 = page。）
细则见 [architecture.md 一·五](./.claude/rules/architecture.md)。

## 3. 默认技术选型

| 关注点 | 选择 | 备注 |
|--------|------|------|
| 视图 | Lit 3.x `LitElement` | Shadow DOM 隔离 |
| 全局状态 | `@lit-labs/signals` + Service 单例 | 跨组件共享 |
| 组件本地状态 | Lit `@property` / `@state` | 弹窗、输入框 |
| 依赖注入 | `@lit-labs/context` | 令牌 + provide/consume |
| 路由 | 自写 `utils/router.js`（History 干净 URL） | **子路径部署禁用 `@lit-labs/router`**（全局 `<a>` 拦截 + 未剥前缀 pathname 会污染路由）；根部署可选它 |
| 请求 | 原生 `fetch` 薄封装 | 不引 axios |
| 持久化 | `localStorage` 薄封装 | 一次性配置 |
| 部署 | OBS + CDN | 无构建直传 |

## 4. 状态放哪？（高频决策）

| 场景 | 方案 |
|------|------|
| 全局业务状态，多页共享（登录态、字典、权限） | **Signal Service + Context 注入**（首选） |
| 组件本地 UI 状态（弹窗开关、表单输入） | Lit `@property` / `@state` |
| 简单应用不想引 signals | `EventTarget` 简易 Store + Context |
| 一次性持久化配置 | `localStorage` 封装（`utils/storage.js`） |

> ⚠️ 两套响应式**必须分开**：跨组件全局业务状态用 **Signal**；组件内部 UI 用 **Lit property**。混用会导致更新时机错乱。

## 5. 部署速查

- **依赖** → 同步 npm 原始 ESM 到 **FMODE Repose**（按版本目录化，开 HTTP/2，`.js` 必须 `text/javascript`，CORS 放行业务域名），全业务共享一份公共 importmap。
- **业务码** → `obsutil` 同步 `src/` 到 OBS（华为云 `obs://www-fmode.cn/<project>/`，南一端点），`public-read`，CDN 指向 `fmode.cn/<project>/`，最后刷新 CDN。
- **子目录部署必须写 `<base href="/<project>/">`**，且 `<base href>` == OBS 上传前缀 == importmap 路径前缀（**同一变量派生 + 脚本硬校验**），否则相对 JS 404。
- **History 回退**：CDN 配置「不存在路径返回 `index.html` 且状态码 **200**」，**严禁 302/301**（否则地址栏被改写、微信 OAuth 回调失败）。
- **CDN 刷新**：`type:directory` + domain_id 对号入座；SDK 返回的 `refresh_task` 是**字符串**（不是 `.id`），失败须退出非 0（否则**假成功**）。
- **验收**：不能只 `curl` 首页 200 —— 须跑模块图爬取（200 + `text/javascript`）+ 深链接 200 + **真实浏览器**。

详见 [deployment.md](./.claude/rules/deployment.md) 与 [routing-best-practices.md](./.claude/rules/routing-best-practices.md)。

## 6. 命名约定（速记）

- 组件文件：`kebab-case.js`，类名 `PascalCase`，自定义元素标签 `kebab-case`（必须含连字符）
- 服务文件：`xxx-service.js`，类 `XxxService`，单例导出 `export const xxxService = new XxxService()`
- 工具文件：`xxx.js`，导出纯函数
- 页面路由：`routes/page-xxx.js`，标签 `<page-xxx>`
- 目录一律小写 kebab-case

## 7. 动手清单（新建项目时）

1. `index.html`：`<base>` + `<script type="importmap" src="<公共importmap>">` + `<script type="module" src="./app.js">`
2. 建 `components/ routes/ services/ utils/`
3. `app.js`：provide 全局 Service + 挂载 Router + 根组件
4. 每个 Service 用 Signal 存状态，单例导出
5. 页面组件 `SignalWatcher(LitElement)` + `consume` Service
6. 部署脚本：`obsutil sync` + CDN refresh

> 具体脚手架：用全局技能 `fmode-code-lit`（`npx fmode-code-lit@latest workspace`）一键生成。

## 8. 写「库」时的动手清单（core / wc）

**抽 core（逻辑层）**：把纯逻辑（状态机 / 校验 / 协议 / 计算）搬到独立包 → `grep` 确认无 `window`/`document`/`fetch`/`lit` →
注入 I/O（`now`/`random`/`transport`）→ `node --test` 单测 → `src/index.js` 单一出口 → semver + Repose 版本目录。
见 [core-library.md](./.claude/rules/core-library.md)。

**抽 wc（组件库）**：逻辑一律来自 core → `static properties` + `customElements.define()`（**判重**）→
只暴露语义属性 / `composed` 事件 / slot / CSS 变量 + `::part` → 标签加统一前缀 → 在**一个非 Lit 宿主**里冒烟。
见 [web-component-library.md](./.claude/rules/web-component-library.md)。
