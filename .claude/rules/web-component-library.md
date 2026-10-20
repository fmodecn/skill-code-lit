# Web Component 组件库规范（wc：仅浏览器交互层）

> 组件库 = 一批**用 `customElements.define()` 注册的自定义元素**，内部封装 **DOM / 交互 / 样式**，
> 逻辑**全部来自核心库 [core](./core-library.md)**。产物是标准 Web Component ——
> 在 Lit、Vue、React、Angular、原生 HTML 里都能**直接写 `<my-x>`**，无需跑任何前端框架。
>
> 与页面内组件（[components.md](./components.md)）的区别：页面组件服务于「一个应用」；
> **组件库组件服务于「多个应用 / 多个框架」**，因此契约更严、实现更克制。

## 一、定位与边界

| 项 | 组件库（wc） | 页面内组件（page） |
|----|--------------|--------------------|
| 消费方 | 多项目、多框架，非本项目也能用 | 仅本应用 |
| 契约 | 语义属性 / DOM 事件 / slot / CSS 自定义属性，**稳定** | 可随应用演进 |
| 业务逻辑 | ❌ 一律来自 core，组件只做**接线** | 可在页面 Service 中 |
| 样式 | Shadow DOM 强隔离，主题走 CSS 变量 | 可宽松 |
| 依赖 | `core` + `lit`（仅 `LitElement`/`html`/`css`） | `core` + 页面 `services/` |

```
fmode-code-agent（core，纯 ESM）
        ▲ 只 import 纯逻辑
  <designer-chat>（wc，LitElement，仅 DOM/交互/样式）
        ▲ 任意框架直接 <designer-chat>
  页面（page：Lit / Vue / React / 原生 HTML …）
```

## 二、铁律（违反即返工）

1. **无装饰器**：与 [components.md 第〇节](./components.md) 一致，`static properties` + `customElements.define()`。组件库要让**任何无构建页面**直接跑，装饰器会让源码 `SyntaxError`。
2. **逻辑不进组件**：状态机 / 校验 / 协议都在 core；组件**只**做「DOM 事件 → 调 core → 用结果重渲染」。组件里能单测的逻辑，都应已在 core 里。
3. **不 import 业务**：组件库不 import 任何应用的 `services/`、`routes/`、业务 model；外部世界只通过**属性**和**事件**进入。
4. **不直接 `fetch`**：网络由**宿主注入**（见第五节）或由 core 的协议函数描述、宿主执行。
5. **样式全在 Shadow DOM**：不写全局 `document.head` 样式；主题只通过 **CSS 自定义属性** + `::part()` 暴露。
6. **标签命名空间**：组件库标签带统一前缀（如 `<fm-chat>`、`<fm-icon>`），**避免与其他库撞名**（撞名 → `define` 抛错）。
7. **注册幂等**：注册前 `customElements.get()` 判空 —— 允许同一页面被加载两次（多入口 / 宿主重复 import）。

## 三、组件骨架（无装饰器、依赖 core）

```js
// src/chat/designer-chat.js
import { LitElement, html, css } from 'lit';
import { AgentMachine } from 'fmode-code-agent';          // ← 核心库（core），纯 ESM

export class DesignerChat extends LitElement {
  /** 对外契约：语义属性 */
  static properties = {
    prompt: { type: String },                // 宿主可传 / attribute 可设
    disabled: { type: Boolean, reflect: true },
    _state: { state: true },                 // 内部：core 的状态映射
    _messages: { state: true },              // 内部：渲染用
  };

  static styles = css`
    :host { display: block; --dc-accent: #2b6cb0; }   /* 主题变量，可被外部覆盖 */
    button { background: var(--dc-accent); }
    .log { max-height: 240px; overflow: auto; }
  `;

  #machine = null;
  #unsubscribe = null;

  constructor() {
    super();
    this.prompt = '';
    this.disabled = false;
    this._state = 'idle';
    this._messages = [];
  }

  /** 宿主注入 I/O（transport），组件层不写死 fetch */
  set transport(t) { this.#machine = new AgentMachine({ transport: t }); }

  connectedCallback() {
    super.connectedCallback();
    if (!this.#machine) {
      // 未注入 transport 时给一个 fallback，避免 use 时崩
      this.#machine = new AgentMachine({ transport: { call: async ({ text }) => ({ text: `(echo) ${text}` }) } });
    }
    this.#unsubscribe = this.#machine.subscribe((s) => { this._state = s; });
    this._state = this.#machine.state;
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    super.disconnectedCallback();
  }

  render() {
    return html`
      <form @submit=${this.#onSubmit}>
        <input .value=${this.prompt} @input=${(e) => { this.prompt = e.target.value; }}
               ?disabled=${this.disabled || this._state !== 'idle'} placeholder="描述你想要的图片…" />
        <button ?disabled=${this.disabled || this._state !== 'idle'}>${this._state === 'idle' ? '生成' : '生成中…'}</button>
      </form>
      <div class="log" part="log">
        ${this._messages.map((m) => html`<p>${m}</p>`)}
      </div>
    `;
  }

  async #onSubmit(e) {
    e.preventDefault();
    const text = this.prompt.trim();
    if (!text) return;
    this._messages = [...this._messages, `> ${text}`];
    /** 子 → 父：语义事件，composed 穿透 Shadow DOM */
    this.dispatchEvent(new CustomEvent('dc-submit', { detail: { prompt: text }, bubbles: true, composed: true }));
    try {
      const result = await this.#machine.send(text);
      this._messages = [...this._messages, result?.text ?? ''];
      this.dispatchEvent(new CustomEvent('dc-done', { detail: { result }, bubbles: true, composed: true }));
    } catch (err) {
      this.dispatchEvent(new CustomEvent('dc-error', { detail: { code: err.code, message: err.message }, bubbles: true, composed: true }));
    }
  }
}

if (!customElements.get('designer-chat')) customElements.define('designer-chat', DesignerChat);
```

要点：
- **对外只有 `prompt` / `disabled` / `transport` / `dc-*` 事件**；`_state` / `_messages` 是内部渲染状态。
- `static styles` 全在 Shadow DOM；外部换主题只改 `--dc-accent`、`::part(log)`。
- 状态来自 core（`machine.subscribe`），组件不自造状态机。
- **用私有字段 `#` 存机器实例**，不挂在公开属性上。

## 四、对外契约（跨框架就是靠这三样）

| 手段 | 用法 | 规则 |
|------|------|------|
| **属性（attribute）** | `<designer-chat disabled>` | 只用**字符串可表达**的语义（`disabled`、`placeholder`、`size="lg"`）；布尔用 `?attr` 或 presence |
| **属性（property）** | 框架里 `el.prompt = '…'`、Lit 里 `.prompt=${x}` | 复杂对象（回调、配置）走 property；**Lit/原生里要用 `.prop=` 绑定**，别指望 attribute 传对象 |
| **事件** | `el.addEventListener('dc-done', fn)` | `kebab-case` 事件名；`detail` 为对象；**`bubbles: true, composed: true`**（穿透 Shadow DOM）；组件库事件统一前缀避免撞车 |
| **Slot** | 宿主投影内容 | `<slot name="header">` / `<slot>`；**不**用 `.innerHTML` |
| **CSS 自定义属性** | `--dc-accent: red` 作用在宿主或其祖先 | 主题的唯一入口 |
| **`::part()`** | `designer-chat::part(log) { ... }` | 需要暴露的内部结构加 `part="…"` |
| **方法（可选）** | `el.focus()`、`el.reset()` | 只给「命令式交互」，不暴露内部状态改写入 |

- **属性即契约**：改属性名 / 事件名 = **破坏性变更** → 升 major（同 core 的版本纪律）。
- **不要暴露**内部类名 / 内部 DOM id（`::part` 是唯一对外样式钩子）。
- **不要用全局事件总线**在组件库内部通信（同 [components.md 第四节](./components.md)）。

## 五、依赖注入：core 实例与 I/O 由宿主注入

组件库**不知道**宿主的网络、登录、路由、存储。两种注入方式：

**A. 宿主直接传实例（最通用，跨框架 OK）**

```html
<script type="module">
  import { AgentMachine } from 'fmode-code-agent';
  const el = document.querySelector('designer-chat');
  el.transport = {
    call: async ({ text }) => {
      const res = await fetch('/api/agent', { method: 'POST', body: JSON.stringify({ text }) });
      return res.json();
    },
  };
</script>
```

**B. Lit 页面里用 Context（仅 Lit 宿主）** —— 见 [context-di.md](./context-di.md)。组件库内部用 `ContextConsumer` 兜底读注入的实例，读不到时用属性。

> 原则：**组件库只定义 shape，不拥有实例**。这也让组件在 Node / SSR 里并不被实例化，逻辑仍留在 core。

## 六、跨框架使用方式

组件的**唯一运行要求**：浏览器能执行 ESM + `customElements`。下图是同一份 `dist` 在四个宿主里的用法：

```html
<!-- ① 原生 HTML（无任何框架） -->
<designer-chat></designer-chat>
<script type="module" src="/npm/designer-chat/v1.0.0/index.js"></script>
```

```html
<!-- ② Lit 页面（本仓页面层）：先 import 触发注册，再在模板里使用 + 监听事件 -->
<script type="module">import './components.js';</script>
<designer-chat .prompt=${q} @dc-done=${(e) => console.log(e.detail)}></designer-chat>
```

```jsx
// ③ React 19：自定义元素已原生支持（prop 走 attribute/property 自动映射）
<designer-chat ref={ref} prompt={q} onDcDone={onDone}></designer-chat>
// ④ React 18-：需包装层（ref + addEventListener），或复用 @lit/react 的 createComponent
```

```vue
<!-- ④ Vue 3：.vue 里把标签加进 compilerOptions.isCustomElement，或 app.config.compilerOptions.isCustomElement -->
<designer-chat :prompt="q" @dc-done="onDone" />
<!-- Vue 3 对自定义元素：attribute 透传；复杂属性建议 ref + el.transport = ... -->
```

| 宿主 | 属性绑定 | 事件 | 注意事项 |
|------|----------|------|----------|
| 原生 / Lit | `.prop=`（Lit） / `el.prop =` | `addEventListener` / `@event` | Lit 必须 **`.` 前缀**绑定复杂值 |
| Vue 3 | `:prop`（复杂值透传为 property） | `@kebab-event` | 配置 `isCustomElement`（构建型 Vue） |
| React 19+ | `prop={...}`（已映射到 property） | `onEvent={...}`（`dc-done` → `onDcDone`） | 事件名注意大小写映射 |
| React 18- | 需 wrapper（`createComponent`） | ref + `addEventListener` | 低版本 React 会把未知 prop 当 attribute |

> **验收口诀**：组件库必须在**一个非 Lit 宿主**（纯 HTML 或 Vue）里也能跑，否则就不是跨框架组件库。

## 七、样式隔离与主题

- **Shadow DOM 是默认**：组件内部样式不泄漏、外部项目样式也不进来。
- **主题三件套**（按优先级）：
  1. **CSS 自定义属性**：`:host { --dc-accent: #2b6cb0 }`，外部可在祖先或宿主上覆盖；
  2. **`::part()`**：`part="log"` 暴露需要精细调整的节点；
  3. **`slots`**：允许宿主替换整块内容（如标题、空状态）。
- **禁止**：`document.adoptedStyleSheets` 注入全局样式；`!important` 向外压制；依赖宿主 CSS 类名。
- 设计令牌（颜色/间距/字号）建议作为**包的静态 CSS** 发布一份（如 `theme.css`），宿主 `<link>` 引入即可，变量名统一前缀（`--fm-`）。

## 八、无构建分发

组件库与 core 一样：**无构建**、源码即产物，托管到 **FMODE Repose**，用 importmap 引入。

```
/npm/designer-chat/v1.0.0/
  index.js                # 入口：import 所有组件并注册（或单组件入口）
  designer-chat.js        # 单组件
  theme.css               # 可选：设计令牌
```

```json
{ "imports": {
  "designer-chat": "/npm/designer-chat/v1.0.0/index.js",
  "fmode-code-agent": "/npm/fmode-code-agent/v2.0.0/src/index.js"
} }
```

- `index.js` **只做 import + 注册**：副作用仅「注册自定义元素」，无渲染、无请求。
- **lit 依赖不内置**：组件库 import 裸 `lit`，由宿主的**公共 importmap** 解析 → 全局单实例 lit（否则重复注册 / 多版本冲突，见 [pitfalls.md 第三节](./pitfalls.md)）。
- **core 依赖版本化**：组件库在 importmap 里映射自己需要的 core 版本；同一页面若用了两个 core major，映射两个标识符（见 [core-library.md 第六节](./core-library.md)）。
- 发布 checklist 中增加：**在一个非 Lit 宿主里 Smoke**（见第九节）。

## 九、验收 & Test

| 层 | 怎么做 |
|----|--------|
| core 逻辑 | `node --test`（不依赖 DOM，见 [core-library.md 第四节](./core-library.md)） |
| 组件契约 | 浏览器里断言：`customElements.get('x-y')` 存在；改属性 → 渲染变化；点按钮 → 事件带 `detail` 且 `composed` |
| 跨框架 | 同一页面用**纯 HTML** 与 **Lit** 各挂一次；两个入口渲染结果一致 |
| 样式隔离 | 宿主页全局 `p { color: red }` **不影响**组件内部；`--dc-accent` 能改主题 |
| 幂等 | 同名脚本 import 两次不报 `define` 冲突 |
| 无装饰器 | `node --check` 全过；`grep` 无 `@property` 等 |

## 十、红线清单

- ❌ 组件里写业务逻辑 / 请求 / 协议解析 → 下沉 core，由宿主注入 I/O
- ❌ 依赖宿主的 CSS 类名 / 全局样式 / 全局 window 变量
- ❌ 暴露内部状态写入方法（`el.setMessages()`），只暴露语义属性 + 语义事件
- ❌ 事件漏 `composed: true` → 穿过 Shadow DOM 后宿主收不到
- ❌ 无前缀标签名（`<chat>` 与别的库撞车）
- ❌ `customElements.define` 不判重 → 二次加载 `NotSupportedError`
- ❌ 组件库内置 lit 副本 → 宿主多实例 lit，见 [pitfalls.md](./pitfalls.md)
- ❌ 装饰器

## 相关

- [core-library.md](./core-library.md) —— 组件库依赖的逻辑层
- [components.md](./components.md) —— 页面内组件；组件库是它的「契约加严版」
- [architecture.md](./architecture.md) —— 三分层总图
- [context-di.md](./context-di.md) —— Lit 宿主中的注入
- [deployment.md](./deployment.md) / [pitfalls.md](./pitfalls.md) —— 分发与多版本冲突
