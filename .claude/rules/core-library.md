# 核心库规范（core：纯 ESM、零浏览器依赖）

> 本仓从「只会写页面」升级为**双方向**：既能写页面（page），也能写 **Web Component 组件库（wc）**
> 与 **跨前端框架的核心库（core）**。三分层总览见 [architecture.md](./architecture.md)，组件库见
> [web-component-library.md](./web-component-library.md)，页面层仍见 [components.md](./components.md)。
>
> **核心库 = 一个普通 npm ESM 包**：不含 Lit、不碰 DOM、可在 Node 里直接 `import` 与单测。
> 浏览器、Node、小程序、SSR、Web Worker 都能跑同一份代码；Web Component 组件库与页面层都**向下依赖**它。

```
[core]  纯 ESM 逻辑库（本文件）       ← 无 DOM / 无 Lit / 无 window / 无 fetch 硬编码
   ↑ import
[wc]    组件库（Web Component）       ← 唯一的浏览器交互层
   ↑ import
[page]  页面（Lit 无构建）            ← 组合 wc 与页内组件
```

## 一、铁律（违反即返工）

1. **零浏览器依赖**：`core/` 下任何文件都不得触碰 `window` / `document` / `navigator` / `localStorage` /
   `fetch` / `HTMLElement` / `CustomEvent` / `import.meta.url` 拼 DOM 路径。**唯一例外**：`node:` 内置模块（Node 可跑）。
2. **不 import Lit**：`import ... from 'lit'` / `lit-html` / `@lit/*` 一律禁止 —— 一旦 import Lit 就绑定了浏览器渲染。需响应式时用 `@lit-labs/signals`（`signal`/`computed`），它本身是纯 JS，可跑在 Node。
3. **只 export 纯逻辑**：纯函数、纯 Class、状态机、校验、格式化、DTO 解析、业务计算。**不 export 单例状态**（每次 `new` 或由调用方注入），不 export「全局 store」。
4. **副作用零**：模块被 `import` 时**不得**执行任何副作用（注册监听、读写存储、发请求、打印）。模块顶层只允许**声明**。
5. **Node 可测**：`core/` 的每个文件都必须能在 Node 里 `import` 并跑通测试；测试**不依赖 jsdom**。
6. **依赖方向单向**：`core` **不认识** `wc` / `page`；`wc`、`page` 认识 `core`。

> 判定口诀：**`node --input-type=module -e "import('./core/index.js')"` 能跑、`grep` 不到 DOM 全局，才是 core。**

## 二、目录规范

```
<lib>/                          # 一个独立的 ESM 包（可跨项目）
  src/
    index.js                    # 公共出口（只在这里 export 对外 API）
    <domain>/                   # 按领域分文件/子目录，如 workflow/、pricing/
      *.js
    internal/                   # 内部实现（不对外 export，可随意重构）
  test/
    *.test.js                   # node:test 单测（不依赖 DOM）
  package.json                  # type: module，exports 映射
```

- **`src/index.js` 是唯一公共契约**；内部实现对 `internal/` 隐藏，外部只能 import 包名（见第五节 exports）。
- **一个文件一个关注点**：`validate.js`（校验）、`machine.js`（状态机）、`format.js`（格式）。
- 命名：小写 kebab-case 文件；`PascalCase` 类；`camelCase` 函数。

## 三、核心库的「好的形状」

| 该做 | 不该做 |
|------|--------|
| `export function validate(input, rules)` —— 纯函数，给什么算什么都由参数决定 | 读 `document.querySelector` 拿「当前表单」 |
| `export class TaskMachine { constructor(config) {} next(event) {} }` —— 状态机，可 `new` 多份 | 模块级 `let store = {}` 饱含状态 |
| 接收**注入**的 I/O（`fetchImpl`、`now`、`random`、`telemetry`） | 直接 `fetch()` / `Date.now()`（不可测） |
| `export const parseConfig = (text) => {...}` | 模块顶层 `localStorage.getItem(...)` |

### 可注入的 I/O（让测试确定化）

```js
// src/pricing/quote.js —— 纯计算，所有不确定输入都从参数注入
export function quote(items, { taxRate = 0.06, now = () => Date.now(), id = () => crypto.randomUUID() } = {}) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  return { id: id(), at: now(), subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}
```

- `now` / `random` / `id` / `fetchImpl` 都可注入 → 测试断言**确定值**，不靠 mock 全局。
- 需要网络时：core 只定义**纯协议**（URL 拼装、DTO 解析），真正的 `fetch` 由 wc/page 层调用后传入结果。

## 四、Node 可测（node:test，不依赖 jsdom）

```js
// test/quote.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote } from '../src/index.js';

test('含税总价四舍五入到分', () => {
  const r = quote([{ price: 19.99, qty: 3 }], { taxRate: 0.06, now: () => 0, id: () => 't1' });
  assert.equal(r.subtotal, 59.97);
  assert.equal(r.total, 63.57);
});
```

运行：`node --test test/`

- **`package.json` 里 `"type": "module"`**，`node --test`/`node --check` 原生识别 ESM。
- 测试命名 `*.test.js`，与源码同构目录。
- **禁止**在 core 测试里引 jsdom / happy-dom —— 需要 DOM 的代码就不该在 core 里。
- CI 一条命令：`node --check`（语法）+ `node --test`（逻辑）。

## 五、无构建打包为单文件（发布给浏览器用）

> 铁律是「**源码不进构建流程**」—— 业务仓 / 页面仓不打包。**发布库**时若确需单文件（如嵌入第三方页面），
> 走**独立发布流水线**、产物归档到 FMODE Repose，源码仍是单文件 ESM。**平时优先「无打包」，不要为了发布而给业务仓加 rollup。**

### 5.1 首选：保持多文件 ESM（零打包）

`core/` 本身就是浏览器原生 ESM 可直接 import 的。只要**相对 import 带 `.js`**，`<script type="module">` 与 `import` 都能直跑。
托管到 Repose `/npm/<lib>/vX.Y.Z/` 目录，importmap 映射：

```json
{ "imports": {
  "my-lib": "/npm/my-lib/v1.2.0/src/index.js",
  "my-lib/": "/npm/my-lib/v1.2.0/src/"
} }
```

> 依赖解析走 importmap（同 [project-structure.md 第五节](./project-structure.md)）；core 若依赖第三方 ESM（如 `signal-polyfill`），
> 同样从 importmap 解析，**不**把第三方源码拷进包内。

### 5.2 需要单文件时：用 `esbuild` 只在**发布**时打一次（不进业务仓）

```bash
# 发布流水线，非业务仓
npx esbuild src/index.js --bundle --format=esm --platform=neutral \
  --outfile=dist/my-lib.esm.js --external:'node:*'
```

- `--format=esm`（保持 ESM），`--platform=neutral`（不假设浏览器）。
- 若要给 `<script src>` 直接挂全局：`--format=iife --global-name=MyLib`（**只给无法用 module 的环境**，默认不用）。
- 产物**归档版本化**（`dist/` 不提交到源码仓，见第六节）。
- **禁用装饰器语法**（同 [components.md 第〇节](./components.md)）：core 里也不写装饰器，即使被打包器编译过 —— 源码即产物铁律延续。

## 六、版本管理与兼容

| 规则 | 说明 |
|------|------|
| **语义化版本** | 公共出口 `src/index.js` 的 API 遵循 semver：破坏性变更 = major |
| **版本目录化（Repose）** | `/npm/<lib>/vX.Y.Z/` 只增不改；升级 = 新增目录 + 改 importmap 版本段，**不覆盖旧版** |
| **单一出口** | 只 `export` 自 `src/index.js`；`package.json` `exports` 只放这一个入口（+ 必要子路径） |
| **不 export 内部路径** | `exports` 里不写 `"./internal/*"`，外部无法深挖 |
| **CHANGELOG** | 每次 major 写清「删了什么 / 改了什么签名」 |
| **多版本共存** | 若两项目用不同 major，可在 importmap 用不同裸标识符（`my-lib` / `my-lib-v2`）指向不同版本目录 |

```jsonc
// package.json —— 核心库
{
  "name": "my-lib",
  "version": "1.2.0",
  "type": "module",
  "exports": { ".": "./src/index.js" },
  "sideEffects": false,
  "files": ["src", "README.md"],
  "scripts": { "check": "node --check src/index.js", "test": "node --test test/" }
}
```

- `"sideEffects": false`：让打引用方（如有）能安全 tree-shake，且**强制**你遵守「模块无副作用」。
- **不 import Lit**：`peerDependencies` 里不要出现 `lit`。

## 七、与 wc / page 的契约

```
fmode-code-agent（逻辑层，core）  ──导出纯逻辑──▶  <designer-chat> / 任何框架的 UI（wc）
                                                        │
                                                        ▼
                                                   Lit 页面（page）组合
```

- core 导出**类/函数**，wc 在组件内部 `new` 它们、监听状态、渲染。
- core 的**状态变化通知**可以用 `@lit-labs/signals`（纯 JS，Node 可跑），也可以是自定义的纯观察者（`subscribe(fn)` 返回 `unsubscribe`）—— 选一个，**别在 core 里用 `EventTarget` 以外的 DOM 事件**（`EventTarget` 在 Node 18+ 可用，可接受；`CustomEvent` 在 Node 需 polyfill，尽量用自定义 `subscribe`）。
- **错误契约**：core 抛**普通 `Error` 子类**，信息里带可判定字段（`code`），不抛 DOMException。

```js
// src/agent/machine.js —— 逻辑层状态机（纯 JS，Node 可测）
export class AgentMachine {
  #listeners = new Set();
  #state = 'idle';
  constructor({ transport }) { this.#transport = transport; }     // 注入 I/O
  get state() { return this.#state; }
  subscribe(fn) { this.#listeners.add(fn); return () => this.#listeners.delete(fn); }
  #emit(next) { this.#state = next; for (const f of this.#listeners) f(next); }
  async send(text) {
    if (this.#state !== 'idle') throw Object.assign(new Error('busy'), { code: 'E_BUSY' });
    this.#emit('thinking');
    try { return await this.#transport.call({ text }); } finally { this.#emit('idle'); }
  }
}
```

- wc 层用 `new AgentMachine({ transport: browserTransport })`；Node 测试注入 `transport: fakeTransport`。
- 同一核心库 → 同一逻辑 → 换任何前端框架 UI 行为一致。

## 八、红线清单

- ❌ `core/` 内出现 `window` / `document` / `localStorage` / `fetch(` / `HTMLElement` / `import 'lit'`
- ❌ 模块顶层有副作用（`addEventListener`、`localStorage`、`console.log`）
- ❌ export 可变单例（「全局配置对象」）
- ❌ `Date.now()` / `Math.random()` 直接写死 → 注入 `now` / `random`
- ❌ 在业务仓引入 rollup/tsc 只为打 core → 发布流水线单独处理
- ❌ 写装饰器
- ❌ 从 `internal/` 深 import

## 九、core 发布 checklist

- [ ] `grep -rE "\b(window|document|localStorage|sessionStorage|navigator)\b|\bfetch\(" src/` 无命中
- [ ] `grep -rn "from 'lit" src/` 无命中
- [ ] 模块导入无副作用：`node -e "import('./src/index.js')"` 干净退出
- [ ] `node --check` 全过；`node --test test/` 全过
- [ ] `src/index.js` 是唯一出口；`exports` 无内部路径
- [ ] semver 版本号 + CHANGELOG；Repose 新版本目录（不覆盖旧版）
- [ ] 相对 import 带 `.js`；第三方依赖走 importmap（不拷源码）

## 相关

- [architecture.md](./architecture.md) —— 三分层（core / wc / page）总图
- [web-component-library.md](./web-component-library.md) —— 组件库（浏览器交互层）
- [components.md](./components.md) —— 页面层组件规范
- [services.md](./services.md) —— 页面内的 Service（也可抽成 core，但若沾 DOM 只能留在页面）
