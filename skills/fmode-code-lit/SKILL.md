---
name: fmode-code-lit
description: "用 Lit 原生 ESM 无构建方式写前端（零编译/零打包/浏览器直跑）。触发词：lit 项目、lit 组件、WebComponent、无构建前端、原生 ESM、importmap、@lit-labs/signals、@lit-labs/context、多标签 KeepAlive、FMODE OBS+CDN 前端部署。适用场景：(1) 新建 lit 无构建项目并生成目录/importmap/骨架 (2) 写 LitElement 组件/Service/路由 (3) 给已有项目补齐前端开发规则 (.claude/rules) (4) 部署到 OBS+CDN 并配 History 回退。产出遵循 fmode-code-lit 规则仓的分层与命名规范。"
description_en: "Build front-ends the Lit native-ESM no-build way (zero compile, zero bundling, runs directly in the browser). Triggers: lit project, lit component, WebComponent, no-build frontend, native ESM, importmap, @lit-labs/signals, @lit-labs/context, multi-tab keep-alive, FMODE OBS+CDN front-end deploy. Use for: (1) scaffolding a new lit no-build project with dirs/importmap/skeleton, (2) writing LitElement components/services/routing, (3) adding front-end dev rules (.claude/rules) to an existing project, (4) deploying to OBS+CDN with History fallback. Output follows the fmode-code-lit rules repo's layering and naming conventions."
schema_version: 1.0.0
level: system
category: development
keywords:
  - lit
  - webcomponents
  - native-esm
  - esm
  - importmap
  - no-build
  - no-bundle
  - signals
  - context
  - router
  - keepalive
  - frontend
  - fmode
version: 1.0.0
author: Yuyang001 (FmodeAgent)
license: MPL-2.0
copyright: "Copyright (c) 2026 未来飞马 Fmode"
tags: [未来飞马, 智能体技能, 超级技能, 开发级, 前端, Lit, WebComponent, 无构建, ESM, FmodeCode, Claude Code]
---

# fmode-code-lit — Lit 原生 ESM 无构建前端

## Overview

教 AI 用 **无构建 / 无打包 / 纯原生 ESM + Lit 3.x** 的方式开发前端：源码即产物，浏览器直接跑，
依赖走 **FMODE Repose** 统一托管，业务码走 **OBS + CDN**。分层（组件 / 服务 / 工具）、
`@lit-labs/signals` 响应式、`@lit/context` 依赖注入、自写 `utils/router.js` History 路由（子路径部署**禁用** `@lit-labs/router`）、后台多标签 KeepAlive。

> 完整规则见 `fmode-code-lit` **规则仓**（本技能随仓发布）。
> 本技能负责「**初始化 + 生成代码**」，规则仓负责「**规范细则**」。

## 何时触发

用户出现以下意图时启用：

- 「新建 / 初始化一个 **lit 项目**」「写一个 **lit 组件**」「**无构建** 前端」「**原生 ESM** + importmap」
- 「WebComponent / Shadow DOM 组件」「signals 响应式」「context 依赖注入」
- 「后台多标签 / KeepAlive」「History 干净路由」
- 「把这套 **前端开发规则** 给项目装上」「部署到 OBS+CDN」

## 三条铁律（生成任何代码前先记住）

1. **源码即产物**：不引入 rollup/esbuild/vite/webpack。写好的 `.js` 直接上传。
2. **依赖不落地项目**：`lit`、`@lit/*`、`@lit-labs/*` 由 **importmap** 指向 FMODE Repose，禁止把依赖拷进业务仓。
3. **分层不越界**：组件→服务→工具。组件禁 `fetch`/复杂业务；服务禁 DOM。

## ⚠️ 无构建环境的硬约束（最容易踩）

**禁用一切装饰器语法**：`@customElement` / `@property` / `@state` / `@consume` / `@provide` / `@query`。
装饰器是 TS/Babel 编译期特性，浏览器原生 JS **不执行**，照抄 Lit 官方「装饰器版」文档会直接 `SyntaxError`。

一律改用标准静态字段 + 编程式 API：

| 装饰器版（❌） | 无构建版（✅） |
|----------------|----------------|
| `@customElement('x-y')` | `customElements.define('x-y', XY)` |
| `@property({type:String}) name` | `static properties = { name: { type: String } }` |
| `@state() kw=''` | `static properties = { kw: { type: String, state: true } }` |
| `@consume({context})` | `new ContextConsumer(this, { context, subscribe, callback })` |
| `@provide({context})` | 模板里 `provide(ctx, value)` 指令 |

## 用法

### 1) 初始化一个新 lit 无构建项目

```bash
# 在目标目录生成标准骨架（index.html + importmap + 分层目录 + 示例组件）
node <skill_dir>/scripts/scaffold.mjs ./my-admin --project my-admin
```

生成结构：

```
my-admin/
  src/
    index.html            # <base> + importmap + 入口
    importmap.json        # 本地 importmap（生产用 Repose 公共 importmap）
    app.js                # provide + 路由 + 根组件
    components/  routes/  services/  utils/
    .claude/rules/        # 前端规则（从规则仓同步）
  package.json            # 仅类型提示，不打包
```

### 2) 给已有项目装上规则

```bash
node <skill_dir>/scripts/install-rules.mjs .      # 写入 ./.claude/rules/ + CLAUDE.md 片段
```

### 3) 生成单个组件 / 服务

```bash
node <skill_dir>/scripts/new.mjs component user-card
node <skill_dir>/scripts/new.mjs service auth-service
node <skill_dir>/scripts/new.mjs page page-order-list
```

### 4) 部署

```bash
bash scripts/deploy.sh <project>   # obsutil 同步 src/ → OBS → CDN 刷新
```

## 关键约定速查

| 项 | 约定 |
|----|------|
| 组件文件 | `kebab-case.js`，类 `PascalCase`，标签含连字符 |
| 页面 | `page-*.js`，标签 `<page-*>` |
| 服务 | `*-service.js`，类 `*Service`，单例 `export const xService = new XService()` |
| 相对导入 | **必须带 `.js` 后缀** |
| 全局状态 | `@lit-labs/signals` 的 signal + `SignalWatcher` |
| 组件本地状态 | `static properties`（`state: true`） |
| 依赖注入 | `@lit/context` 的 `provide()` + `ContextConsumer`（**非** `@lit-labs/context`，已废弃） |
| 路由 | 自写 `utils/router.js`，History 干净 URL（子路径部署**禁用** `@lit-labs/router`） |
| 子目录部署 | 必须 `<base href="/<project>/">` |

## 依赖版本（2026-10 实测可用）

```
lit@3.3.3  lit-html@3.3.3  lit-element@4.2.2  @lit/reactive-element@2.1.2
@lit/context@1.1.6  @lit-labs/signals@0.3.0  signal-polyfill@0.2.2
```

> 注意：`@lit-labs/signals` 依赖 **`signal-polyfill`**，importmap 必须映射它（入口 `dist/index.js`）。
> `@lit-labs/context` 已废弃 → 用 **`@lit/context`**。

## 部署要点

- 依赖 → FMODE Repose（按版本目录，`.js` 必须 `Content-Type: text/javascript`，CORS 放行业务域名，开 HTTP/2）。
- 业务码 → `obsutil sync src/ obs://<bucket>/<project>/`（`public-read`），再刷 CDN。
- **CDN History 回退**：不存在路径返回 `index.html` 且状态码 **200**，**禁 302**（否则地址栏改写、OAuth 回调失败、路由丢失）。
- `<base href>` 与部署前缀一致；`index.html` 设 `no-cache`。

## 常见坑（详见规则仓 `.claude/rules/pitfalls.md`）

装饰器 / CORS / MIME 非 JS / lit 多版本混用 / CDN 302 / base href 缺失 / 相对 import 漏 `.js` /
signal 与 property 混用 / 老浏览器无 Import Map / 循环依赖。

## 诚实失败

生成前先探测目标目录；已存在文件**不覆盖**（除非 `--force`）。若依赖版本无法从 Repose 解析，
明确报错并给出配置指引，**不生成一个跑不起来的骨架**。
