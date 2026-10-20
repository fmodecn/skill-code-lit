# 组件规范（LitElement）

> 组件只做一件事：**把数据渲染成 DOM，并把用户事件转成对 Service 的调用**。
> 复杂业务逻辑、请求、状态计算 —— 全部下沉到 Service。
>
> **本文件讲「页面层组件」**（服务于本应用的 UI）。若这个组件要**跨项目 / 跨框架**复用，
> 它是**组件库（wc）**，契约更严、逻辑必须来自 [core](./core-library.md) —— 见
> [web-component-library.md](./web-component-library.md)。分层总图见 [architecture.md 一·五](./architecture.md)。

## 〇、无构建环境的第一约束：**禁用装饰器**

> ⚠️ **禁用 `@customElement` / `@property` / `@state` / `@consume` 等装饰器语法。**
> 装饰器是 **TypeScript / Babel 的编译期特性**，浏览器**原生不执行**。无构建（源码即产物）下，
> 一旦写装饰器，浏览器直接 `SyntaxError`。所有 Lit 官方「装饰器版」文档**不能照抄**。

一律改用**标准静态类字段 + 编程式 API**：

| 装饰器版（❌ 禁） | 无构建版（✅ 用） |
|-------------------|-------------------|
| `@customElement('x-y')` | 类末尾 `customElements.define('x-y', XY)` |
| `@property({ type: String }) name` | `static properties = { name: { type: String } }` |
| `@state() kw = ''` | `static properties = { kw: { type: String, state: true } }` + constructor 初始化 |
| `@consume({ context })` | `new ContextConsumer(this, { context, subscribe, callback })` |
| `@provide({ context })` | 模板里的 `provide(ctx, value)` 指令（见 context-di.md） |
| `@query('#x')` | `this.renderRoot.querySelector('#x')` |
| `@queryAssignedElements` | `this.querySelectorAll('slot')` / `slot.assignedElements()` |

> `static properties` 是 Lit 的**标准 API**（装饰器只是它的语法糖），无构建下完全可用。

## 一、最小组件骨架（无装饰器）

```js
// components/user-card.js
import { LitElement, html, css } from 'lit';

export class UserCard extends LitElement {
  static properties = {
    name: { type: String },
    user: { type: Object },
  };

  static styles = css`
    :host { display: block; padding: 12px; border: 1px solid #eee; border-radius: 8px; }
    .name { font-weight: 600; }
  `;

  constructor() {
    super();
    this.name = '';
    this.user = null;
  }

  render() {
    return html`
      <div class="name">${this.name}</div>
      <slot></slot>
    `;
  }

  /** 事件只做转发，不做业务 */
  _onClick() {
    this.dispatchEvent(new CustomEvent('card-click', {
      detail: { user: this.user },
      bubbles: true,
      composed: true,   // 穿透 Shadow DOM 边界，必须
    }));
  }
}

customElements.define('user-card', UserCard);
```

## 二、Lit 核心特性用法

| 特性 | 用途 | 要点 |
|------|------|------|
| `` html`...` `` | 声明式模板 | 自动转义（**天然防 XSS**）；模板字面量按内容缓存，只更新变化部分 |
| `` css`...` `` | 组件样式 | 在 Shadow DOM 内生效，样式隔离 |
| Shadow DOM | DOM/CSS 隔离 | 默认 `open`；跨边界事件需 `composed: true` |
| `@property` | 对外属性（UI 状态 / 入参） | 会触发重渲染，默认 attribute 反射 |
| `@state` | 内部私有状态 | 不对外暴露、不反射到 attribute |
| `requestUpdate()` / `updateComplete` | 手动触发 / 等待渲染 | 备选手段，优先用 property 驱动 |
| `<slot>` | 插槽 | 封装通用布局组件（弹窗外壳、面板） |

## 三、响应式：本地 vs 全局（关键分界）

> ⚠️ **两套响应式必须分开**，混用会导致更新时机错乱。

| 场景 | 怎么用 |
|------|--------|
| 组件内部 UI（弹窗开关、输入框值、tab 高亮） | Lit `@property` / `@state` + `this.requestUpdate()` |
| 跨组件全局业务状态（登录态、字典、购物车、权限） | `@lit-labs/signals`，组件用 `SignalWatcher` 混入 |

需要全局 signal 的组件：用 `SignalWatcher(LitElement)` 包裹，signal 变化自动重渲染。

```js
import { LitElement, html } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { authService } from '../services/auth-service.js';

export class PageDashboard extends SignalWatcher(LitElement) {
  render() {
    // authService.user 是 signal：读取即订阅，变化自动重渲染
    return html`<h1>你好，${authService.user.get()?.name ?? '访客'}</h1>`;
  }
}
```

## 四、组件通信

| 方向 | 手段 |
|------|------|
| 父 → 子 | `static properties` 声明的属性（attribute 或 `.prop=${x}` 绑定） |
| 子 → 父 | `dispatchEvent(new CustomEvent('x', { bubbles, composed }))` |
| 任意 ↔ 任意 | **Service + Signal**（首选），组件只读 signal / 调方法 |
| 组件树深层传递依赖 | `@lit-labs/context` 的 `provide()` 指令 + `ContextConsumer`，见 [context-di.md](./context-di.md) |

- 事件名用 `kebab-case`，`detail` 用对象。
- 跨 Shadow DOM 边界必须 `composed: true`，否则父级监听不到。
- **禁止**用全局事件总线撒逻辑——用 Service。

## 五、绝对禁止

- ❌ 用装饰器（`@customElement`/`@property`/`@consume`…）—— 无构建下浏览器不执行，见第〇节。
- ❌ 组件里 `fetch` / 写接口地址 —— 交给 Service。
- ❌ 组件里写复杂业务计算 / 校验 —— 交给 Service 或 utils。
- ❌ 组件 new 另一个组件需要的 Service —— 用 `ContextConsumer` 或直接 import 单例。
- ❌ 用全局 signal 存「只影响本组件」的状态 —— 用 `static properties` 的 `state: true`。
- ❌ 跨版本混用 `lit` —— 自定义元素注册冲突，见 [pitfalls.md](./pitfalls.md)。

## 六、可复用组件的封装原则

- **只暴露语义属性**（`label`、`value`、`disabled`），不暴露内部实现细节。
- **用 slot 做内容投影**，不要用 `<... .innerHTML>` 传 HTML。
- **样式可覆盖**：暴露 CSS 自定义属性（`--card-bg`）而非改内部 class。
- 通用性强的组件抽到独立目录并考虑托管到 **FMODE Repose 组件库**，跨项目复用。

## 七、从「页内组件」升级为「组件库组件」

同一个组件，跨项目复用时契约要加严。判断与落地：

| 信号 | 动作 |
|------|------|
| 第二个项目要引它 / 换框架也要用 | 迁出为**组件库（wc）**，见 [web-component-library.md](./web-component-library.md) |
| 组件里长出了业务逻辑（校验 / 协议 / 状态机） | 把逻辑**下沉 core**（[core-library.md](./core-library.md)），组件只保留接线 |
| 组件里出现 `fetch` / 依赖宿主全局变量 | 改成**宿主注入**（`el.transport = ...`），组件库不拥有 I/O |
| 需要让非 Lit 宿主也能用 | 标签加统一前缀；事件 `composed: true`；只通过 `static properties` + slot + CSS 变量暴露 |

三句话记住三分层：

- **core**：不认识 DOM 的纯逻辑（Node 可测）。
- **wc**：不认识业务的 Web Component（跨框架）。
- **page**：组装 core 与 wc 的页面（本文件其余章节讲的就是它）。
