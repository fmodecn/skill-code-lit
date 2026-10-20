# core-wc —— core / wc / page 三分层最小示例

**同一份逻辑，三层产物**：一个纯 ESM 核心库（Node 可测）、一个 Web Component 组件库（跨框架）、
一个 Lit 无构建页面（组合）。零构建、零打包、**无装饰器**。

```
core/                    [core] 纯 ESM 逻辑库 —— 零浏览器依赖
  index.js               # 唯一公共出口
  quote.js               # 报价计算（纯函数 + 注入的 now/id）
  package.json           # type: module / sideEffects: false / exports 单一入口
wc/                      [wc]  组件库 —— 仅浏览器交互
  quote-calc.js          # <quote-calc>（LitElement，逻辑全部来自 core）
  browser-transport.js   # 浏览器 I/O 适配器（唯一碰 fetch 的地方）
  index.js               # 入口：只做注册
  plain.html             # 跨框架演示：纯 HTML 直接用 <quote-calc>
page/                    [page] 页面层 —— 组合
  app.js                 # Lit 页面：注入 transport + 监听事件 + 组合组件
  index.html             # <base> + importmap
test/
  quote.test.js          # core 单测（node:test，不依赖浏览器/jsdom）
scripts/
  check.mjs              # 静态体检：core 零 DOM / 无装饰器 / import 后缀 / 注册幂等
```

## 跑起来

### 1. core 单测（不需要浏览器）

```bash
cd examples/core-wc
node --test test/*.test.js
```

### 2. 静态体检

```bash
node scripts/check.mjs
```

断言四条红线：`core/` 不含 `window`/`document`/`fetch`、`core/` 不 import lit、
全仓无装饰器、`customElements.define` 均有 `get()` 判重。

### 3. 浏览器（页面 + 跨框架）

需要站点根下存在 `core-wc/` 前缀（页面里写的是 `<base href="/core-wc/page/">`）。

```bash
# 方式 A：指向 FMODE Repose（内网可达）
#   index.html / plain.html 保持 <script type="importmap" src="/npm/importmap/lit-v3.json">
cd /opt/data/git-repos/fmode-code-lit
npx --yes serve examples -l 3000
# 打开 http://localhost:3000/core-wc/page/index.html   （Lit 页面）
# 打开 http://localhost:3000/core-wc/wc/plain.html     （纯 HTML 宿主）

# 方式 B：本地离线（无需内网）—— 用 npm 装的 lit
cd examples/core-wc
npm install                                   # 只装 lit，仅本地预览用
# 把 page/index.html 与 wc/plain.html 的 <base> 改成 "/"，
# 并把 importmap 那行换成内联（lit 内部还 import @lit/reactive-element，必须一并映射）：
#   <script type="importmap">{"imports":{
#     "lit":"/node_modules/lit/index.js","lit/":"/node_modules/lit/",
#     "lit-html":"/node_modules/lit-html/lit-html.js","lit-html/":"/node_modules/lit-html/",
#     "lit-element":"/node_modules/lit-element/lit-element.js","lit-element/":"/node_modules/lit-element/",
#     "@lit/reactive-element":"/node_modules/@lit/reactive-element/reactive-element.js",
#     "@lit/reactive-element/":"/node_modules/@lit/reactive-element/"
#   }}</script>
npx --yes serve . -l 3000
# 打开 http://localhost:3000/page/index.html 与 http://localhost:3000/wc/plain.html
```

> `<base href>` 与目录结构有关：上面的路径按「站点根 = `examples/`」写。若直接从
> `examples/core-wc/` 起服务，把 `<base>` 相应改为 `/page/` 与 `/wc/`。

### 4. 真实浏览器验收（本仓纪律：不能只 curl）

```bash
npm i -D playwright && npx playwright install chromium
python3 -m http.server 4000 &            # 站点根 = examples/
node scripts/browser-verify.mjs http://127.0.0.1:4000/core-wc
```

覆盖 11 项：组件注册 / property 渲染 / Shadow DOM 样式隔离 / 事件穿透 `composed` /
core 计算结果 / Lit 页面宿主 / 纯 HTML 宿主 / 重复 import 幂等 / 主题变量。
（`/favicon.ico` 的 404 是无 favicon 的必然噪音，脚本已排除。）


## 演示点

- **core 零浏览器依赖**：`core/quote.js` 里没有 `window`/`document`/`fetch`，不 import lit；
  `now`/`id` 通过参数注入 → `node --test` 直接断言确定值。
- **wc 只做接线**：`<quote-calc>` 不自己算钱、不自己 fetch；算钱调 core，网络由宿主注入 `transport`。
- **契约跨框架**：只暴露 `items`/`discount`/`disabled` 属性、`quote-done`/`quote-error` 事件
  （`composed: true` 穿透 Shadow DOM）、`<slot name="title">`、`--qc-accent` 变量。
- **跨框架运行**：`page/index.html`（Lit 宿主）与 `wc/plain.html`（纯 HTML）用的是**同一个**
  `quote-calc.js`，无需任何适配。
- **样式隔离**：页面 `body { background }` 之类全局样式进不去组件；换主题只改 `--qc-accent`。
- **无装饰器**：`static properties` + `customElements.define()`（判重）。

## 与规则仓的对应

| 目录 | 规则篇 |
|------|--------|
| `core/` | [.claude/rules/core-library.md](../../.claude/rules/core-library.md) |
| `wc/` | [.claude/rules/web-component-library.md](../../.claude/rules/web-component-library.md) |
| `page/` | [.claude/rules/components.md](../../.claude/rules/components.md) · [architecture.md](../../.claude/rules/architecture.md) |
