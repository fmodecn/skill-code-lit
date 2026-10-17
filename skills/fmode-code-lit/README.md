# fmode-code-lit · Lit 原生 ESM 无构建前端技能

> **未来飞马 — 让 AI 进化提前发生，让 AI 落地快人一步**

[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-brightgreen.svg)](LICENSE)
[![ESM](https://img.shields.io/badge/module-native--ESM-orange.svg)](#)

---

## 简介

`fmode-code-lit` 是教 AI 用 **无构建 / 无打包 / 纯原生 ESM + Lit 3.x** 写前端的 Claude Code 技能：
源码即产物，浏览器直接跑；依赖走 **FMODE Repose** 统一托管，业务码走 **OBS + CDN**。

配套 **规则仓**（本仓 `.claude/rules/`）提供分层、组件、服务、DI、路由、多标签、部署等完整规范。

适用 **FmodeCode / Claude Code / FmodeAgent**；本技能以原生 ESM 与零依赖脚本交付，Node ≥ 18 直接运行。

## 核心能力

- 🏗 **项目脚手架** —— 一键生成无构建 Lit 项目骨架（index.html + importmap + 分层目录）
- 🧩 **单元生成器** —— `component` / `service` / `page` 按规范生成（**无装饰器**）
- 📏 **规则安装器** —— 把 `.claude/rules/` 前端规则装入任意项目
- 🚀 **部署模板** —— `obsutil` 同步 OBS + CDN 刷新的脚本
- 📚 **完整规则仓** —— 架构 / 组件 / 服务 / DI / 路由 / 多标签 / 部署 / 坑位

## 快速开始

### 1) 给项目装技能 + 规则

```bash
# 装到当前项目的 .claude/skills/（随项目走，推荐）
npx --yes fmode-code-lit@latest workspace

# 或装到用户级 ~/.claude/skills/（全局）
npx --yes fmode-code-lit@latest install

# 把前端规则写入项目 ./.claude/rules/
npx --yes fmode-code-lit@latest rules .
```

### 2) 新建无构建 Lit 项目

```bash
npx --yes fmode-code-lit@latest scaffold ./my-admin --project my-admin
cd my-admin && npx serve src      # 本地预览
```

### 3) 生成组件 / 服务 / 页面

```bash
npx --yes fmode-code-lit@latest new component user-card
npx --yes fmode-code-lit@latest new service auth-service
npx --yes fmode-code-lit@latest new page page-order-list
```

### 4) 部署

```bash
OBS_BUCKET=obs://<bucket> bash scripts/deploy.sh my-admin
```

## 三条铁律

1. **源码即产物** —— 不引入任何打包器，写好的 `.js` 直接上传。
2. **依赖不落地项目** —— `lit` / `@lit/*` / `@lit-labs/*` 由 importmap 指向 Repose。
3. **分层不越界** —— 组件（渲染）→ 服务（业务/状态）→ 工具（纯函数）。

## ⚠️ 无构建硬约束：禁用装饰器

浏览器**原生不执行**装饰器语法（`@customElement` / `@property` / `@state` / `@consume`）。
一律用 `static properties` + `customElements.define()` + `ContextConsumer`。本技能生成的所有代码均无装饰器。

## 依赖版本（2026-10 实测）

```
lit@3.3.3  lit-html@3.3.3  lit-element@4.2.2  @lit/reactive-element@2.1.2
@lit/context@1.1.6  @lit-labs/signals@0.3.0  signal-polyfill@0.2.2  @lit-labs/router@0.1.4
```

> `@lit-labs/signals` 依赖 `signal-polyfill`（importmap 需映射，入口 `dist/index.js`）。
> `@lit-labs/context` 已废弃 → 用 `@lit/context`。

## 目录

```
skills/fmode-code-lit/
├── SKILL.md                     # 技能说明（AI 读取）
├── skill-package-manifest.json  # 打包清单
├── package.json                 # npx 入口
├── bin/fmode-code-lit.js        # CLI
└── scripts/
    ├── scaffold.mjs             # 项目脚手架
    ├── new.mjs                  # 组件/服务/页面生成器
    ├── install-rules.mjs        # 规则安装器
    ├── install.mjs              # 技能安装器
    └── smoke.mjs                # 自检
```

## 自检

```bash
node skills/fmode-code-lit/scripts/smoke.mjs
# ✓ 生成物全部通过语法检查 / ✓ 生成物无装饰器语法 / … → SMOKE OK
```

## 许可

MPL-2.0 © 未来飞马 Fmode
