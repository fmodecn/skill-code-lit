# fmode-code-lit · Lit 原生 ESM 无构建开发规则仓

> **未来飞马 — 让 AI 进化提前发生，让 AI 落地快人一步**

`fmode-code-lit` 是 FMODE 组织下的 **前端开发规则仓库**：为「无构建 / 无打包 / 纯原生 ESM + Lit 3.x」的轻量级 Web 应用
定义一套可被 AI（Claude Code / FmodeCode）直接执行的工程规则、目录范式、组件/服务分层规范与部署规范。

本仓 **不是** 一个前端框架，也 **不是** 一个 npm 库。它是一份 **规则 + 示例 + 脚手架技能** 的组合体：

| 交付物 | 路径 | 作用 |
|--------|------|------|
| 规则总纲 | [`CLAUDE.md`](./CLAUDE.md) | AI 进入本仓/引用本仓时的第一入口，索引全部规则 |
| 分层规则 | [`.claude/rules/`](./.claude/rules/) | 架构、目录、组件、服务、DI、路由、多标签、部署、坑位逐篇规范 |
| **核心库规范** | [`.claude/rules/core-library.md`](./.claude/rules/core-library.md) | 纯 ESM 核心库：零浏览器依赖 / 只 export 纯逻辑 / Node 可测 / 无构建打包 / 版本管理 |
| **组件库规范** | [`.claude/rules/web-component-library.md`](./.claude/rules/web-component-library.md) | Web Component 组件库（**用 Lit 实现、禁原生 wc 手写**）：customElements 注册、属性/事件/Slot、**跨框架**用法、依赖核心库、样式隔离 |
| **路由实战** | [`.claude/rules/routing-best-practices.md`](./.claude/rules/routing-best-practices.md) | 子路径部署路由最佳实践：base 三处同源 / `new URL` 丢前缀 / 弃用 `@lit-labs/router` / CDN 刷新假成功 / 不能只 curl 验收 |
| 模块划分 | [`.claude/rules/modules/`](./.claude/rules/modules/) | 功能模块 / 通用能力 / 业务模块 的拆分最佳实践 |
| 源稿 | [`.claude/_lit-dev-manual.md`](./.claude/_lit-dev-manual.md) | 用户提供的《Lit 原生 ESM 无构建开发最佳实践》原始规范 |
| 可运行示例（页面） | [`examples/hello-lit/`](./examples/hello-lit/) | 零构建、可直接上 OBS+CDN 的最小多标签后台示例 |
| **可运行示例（三层）** | [`examples/core-wc/`](./examples/core-wc/) | **core 纯 ESM + wc Web Component + page Lit 页面**，含 Node 单测与跨框架（纯 HTML）演示 |
| 全局技能 | [`skills/fmode-code-lit/`](./skills/fmode-code-lit/) | 给 AI 的 Lit 项目初始化技能（触发词：lit 项目 / 组件 / 无构建前端） |
| 复盘 | [`docs/retrospective.md`](./docs/retrospective.md) | 纯原生 ESM × Lit 3.x，对标 Angular zoneless |

## 一句话记住它

> **源码即产物。写完的 `.js` 不需要编译，浏览器原生 ESM 直接跑；依赖走 FMODE Repose 统一托管，业务码走 OBS+CDN，保存刷新即预览。**

## 两个方向：页面 & 库

本仓同时覆盖**两个开发方向**，共用同一套无构建铁律：

```
[core] 纯 ESM 核心库   零浏览器依赖、Node 可测 —— 跨前端框架最底层
   ▲ import
[wc]   组件库（Lit 实现的 Web Component）   仅浏览器交互、零业务逻辑 —— <my-x> 跨框架直接用
   ▲ import
[page] Lit 无构建页面   组合 core 与 wc，持有路由 / 布局 / 服务
```

**core 不认识 DOM，wc 不认识业务，page 组装一切。**

> **wc 用 Lit 写，不手写原生 wc**：组件一律 `extends LitElement` + `html` + `css`。Lit 本身构建在 Web Component 标准之上，
> 产出的就是标准自定义元素，所以跨框架复用不受影响；禁止 `extends HTMLElement` / `attachShadow()` 这类原生写法。

| 你想做的事 | 往哪写 | 规则篇 |
|-----------|--------|--------|
| 一段逻辑要在 **Node、浏览器、多个前端框架** 里都能用 | **core** | [core-library.md](./.claude/rules/core-library.md) |
| 一个 UI 要让 **Lit / Vue / React / 原生 HTML** 都能 `<my-x>` 用 | **wc** | [web-component-library.md](./.claude/rules/web-component-library.md) |
| 只做**本应用**的页面、路由、布局 | **page** | [components.md](./.claude/rules/components.md) · [architecture.md](./.claude/rules/architecture.md) |

> 例：`fmode-code-agent` 的逻辑层 = **core**（纯 ESM）；`<designer-chat>` = **wc**（组件）；
> 后台页面 = **page**（组合）。换前端框架时，**core 一行不改**；换 UI 库时，**core 与 wc 都不改**。
>
> 别为了分层而分层 —— 只服务本项目时停在 **page** 即可；一旦「换框架还要复用」，逻辑必须下沉 core。


## 技术底座

- **运行时**：浏览器原生 ESM `<script type="module">` + Import Map
- **视图**：Lit 3.x（`LitElement` / `html` / `css` / Shadow DOM）
- **响应式**：`@lit-labs/signals`（跨组件细粒度信号）
- **依赖注入**：`@lit-labs/context`（组件树 Context）
- **路由**：自写 `utils/router.js`（History 干净 URL，支持微信 OAuth 回调）｜子路径部署**禁用** `@lit-labs/router`
- **分层**：WebComponent（视图） / Service（状态与业务） / Utils（无状态函数）
- **部署**：FMODE Repose（依赖仓）+ OBS + CDN（业务托管，History 回退 200）

## 快速上手

```bash
# 1. 用全局技能初始化一个新 Lit 项目
npx --yes fmode-code-lit@latest workspace   # 或：安装到项目 ./.claude/skills/fmode-code-lit

# 2. 或直接拷贝示例改
cp -r examples/hello-lit my-admin && cd my-admin

# 3. 部署（无构建，直接同步 src/ 到 OBS+CDN）
./scripts/deploy.sh my-admin
```

## 适用 / 不适用

| 适用 | 不适用 |
|------|--------|
| 内部中后台、运营后台、活动页、嵌入页 | 需要 SSR / SEO 首屏的重内容站点 |
| 组件跨项目复用、样式强隔离 | 需要复杂构建期优化（tree-shaking 极致、TS 全量类型）的大团队应用 |
| 追求「改一行、刷新即见」的快速迭代 | 需要兼容 IE / 老浏览器（Import Map 需 polyfill） |
| 依赖只是 lit 系 + 少量 ESM 库 | 依赖包含大量 CJS / 需要打包器转译的 npm 包 |

## 目录约定（本仓）

```
fmode-code-lit/
├── CLAUDE.md                    # 规则总纲（AI 入口）
├── .claude/
│   ├── _lit-dev-manual.md       # 源稿
│   └── rules/                   # 分层规则（见下）
├── examples/hello-lit/          # 可运行示例
├── skills/fmode-code-lit/       # 全局技能源码
└── docs/retrospective.md        # 技术复盘
```

## 许可证

MPL-2.0 © 未来飞马 Fmode
