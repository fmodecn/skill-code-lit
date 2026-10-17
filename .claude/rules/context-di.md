# 依赖注入（@lit-labs/context）

> Context 用于把「全局 Service / 配置」注入到组件树深层，避免逐层 `@property` 透传（prop drilling）。
> 与 Angular 的 DI 对标，但更轻：**令牌 + provide + consume**。

## 一、三件套

| API | 作用 |
|-----|------|
| `createContext<T>(key)` | 定义一个注入令牌（模块级唯一） |
| `provide({ context, initialValue })` | 在某个祖先元素上提供值（通常根组件） |
| `consume({ context, subscribe })` | 在子组件里消费值 |

## 二、定义令牌

```js
// services/contexts.js —— 令牌集中定义，避免散落
import { createContext } from '@lit-labs/context';
import { authService } from './auth-service.js';

export const authContext = createContext('fmode.auth');
// 也可以为普通配置/值建令牌
export const configContext = createContext('fmode.config');
```

- 令牌 key 用命名空间前缀（`fmode.xxx`）避免与第三方冲突。
- 令牌必须**同一模块实例**：多处 `createContext` 会得到不同令牌 → 注入失败。集中定义。

## 三、在根组件提供（provide）

```js
// app.js 或根组件
import { LitElement, html } from 'lit';
import { provide } from '@lit-labs/context';
import { authContext, configContext } from './services/contexts.js';
import { authService } from './services/auth-service.js';

export class AppRoot extends LitElement {
  render() {
    return html`
      ${provide(authContext, authService)}
      ${provide(configContext, { apiBase: '/api', appName: 'Admin' })}
      <app-shell></app-shell>
    `;
  }
}
```

- `provide` 是一个「无渲染」的模板指令，放在祖先组件 render 里，向下对所有后代生效。
- 通常**只在根组件 provide**（全局单例 Service），不要把 provide 散在各处。

## 四、在子组件消费（consume）

> ⚠️ 无构建下**禁用 `@consume` 装饰器**，改用编程式 `ContextConsumer`。

```js
import { LitElement, html } from 'lit';
import { ContextConsumer } from '@lit-labs/context';
import { authContext } from '../services/contexts.js';

export class UserBadge extends LitElement {
  static properties = { _auth: { state: true } };

  #consumer = new ContextConsumer(this, {
    context: authContext,
    subscribe: true,                       // 提供的「实例」被替换时回调
    callback: (value) => { this._auth = value; },
  });

  render() {
    return html`<span>${this._auth?.user.get()?.name ?? '未登录'}</span>`;
  }
}

customElements.define('user-badge', UserBadge);
```

- `subscribe: true`：当提供的**值本身**被替换为另一个实例时，组件重新响应（不是 signal 变化，而是「注入对象换了」）。
- 注入对象内部的 signal 变化，由 `SignalWatcher` 负责驱动重渲染 —— 两者配合。
- 父组件提供用模板指令 `provide(ctx, value)`（见第三节），同样无需装饰器。

## 五、何时用 Context，何时直接 import

| 情况 | 做法 |
|------|------|
| 全局单例 Service，确定唯一 | **直接 `import` 单例** 即可（最简单，推荐） |
| 需要「同组件树不同区块用不同实例」（多实例 / 可测试替换） | **Context**（provide 不同实例） |
| 需要向下传配置 / 主题 / 环境值 | **Context** |

> 务实建议：**默认直接 import 单例**；只有当「同一组件要能跑在不同注入环境」时才上 Context。别为了 DI 而 DI。

## 六、与 SignalWatcher 配合

- `consume` 拿到的是 **Service 实例**（不一定变化）。
- Service 里的 **signal** 变化 → 由混入 `SignalWatcher` 的组件自动重渲染。
- 两者职责不同：`consume` 解决「拿到谁」，`SignalWatcher` 解决「谁变了要重渲染」。

## 七、坑

- 令牌模块重复实例化 → consume 拿不到 → 返回 `undefined`。**令牌必须集中定义、单例导出**。
- 在 `render()` 外读取 consumed 属性可能为 `undefined`（首次渲染前）；用可选链。
- provide 的作用域是「该元素的子树」，provide 写错层级 → 后代拿不到。
