# 服务规范（Service / Signal）

> Service 是普通 ESM Class：**存全局状态（Signal）、封装接口、做校验与转换、写业务计算**。
> 它**不依赖 DOM、不 import Lit**，因此能在 Node 里直接单测。

## 一、Service 骨架（Signal + 单例）

```js
// services/auth-service.js
import { signal, computed } from '@lit-labs/signals';
import { http } from '../utils/http.js';

class AuthService {
  /** 私有信号：当前用户（null 表示未登录） */
  #user = signal(null);
  /** 私有信号：token，初始化时从 localStorage 恢复 */
  #token = signal(localStorage.getItem('token') || '');

  /** 对外只读视图 */
  get user() { return this.#user; }
  get isLoggedIn() { return computed(() => this.#user.get() != null); }

  async login(username, password) {
    const { token, user } = await http.post('/api/auth/login', { username, password });
    this.#token.set(token);
    this.#user.set(user);
    localStorage.setItem('token', token);
    return user;
  }

  logout() {
    this.#token.set('');
    this.#user.set(null);
    localStorage.removeItem('token');
  }

  getToken() { return this.#token.get(); }
}

/** 全局单例：全应用共享同一份状态 */
export const authService = new AuthService();
```

要点：
- 状态用 `signal()` 持有；派生值用 `computed()`；副作用用 `effect()`。
- 对外通过 getter 暴露**只读** signal，写操作走方法（封装校验）。
- **单例导出**（`export const xxxService = new XxxService()`），全应用 import 同一实例。
- 不在 Service 里 `import { html }` 或操作 `document`。

## 二、Signal 三件套

| API | 用途 | 例 |
|-----|------|----|
| `signal(v)` | 可读写信号 | `const count = signal(0); count.set(1); count.get();` |
| `computed(fn)` | 派生只读信号 | `const total = computed(() => items.get().length);` |
| `effect(fn)` | 副作用（自动追踪依赖） | `effect(() => console.log(count.get()));` |

> 在组件里用 `SignalWatcher(LitElement)` 混入后，`render()` 里**读取** signal 即自动订阅。

## 三、状态放哪（再强调）

| 场景 | 方案 |
|------|------|
| 全局业务状态，多页共享（登录 / 字典 / 权限） | **Signal Service**（本文件） + Context 注入 |
| 组件本地状态（弹窗 / 输入） | Lit `@property` / `@state` |
| 简单应用不想引 signals | `EventTarget` 简易 Store（下方） |
| 一次性持久化配置 | `utils/storage.js` 封装 |

## 四、不引 signals 时的简易 Store

```js
// services/store.js —— 仅当不想引 @lit-labs/signals 时的轻量替代
export class Store extends EventTarget {
  #state = {};
  get state() { return this.#state; }
  setState(patch) {
    this.#state = { ...this.#state, ...patch };
    this.dispatchEvent(new CustomEvent('change', { detail: this.#state }));
  }
}
export const store = new Store();
```

组件里监听 `store.addEventListener('change', () => this.requestUpdate())`。

## 五、Service 与 DOM 的边界

- Service **可以** 读写 `localStorage`、调 `fetch`、算业务 —— 这些是「环境无关」的。
- Service **不可以** 持有元素引用、操作 `document`、`import Lit`。
- 需要通知 UI 的地方 → 改 signal，UI 自然响应，**不要**反向去 call 组件方法。

## 六、可测试性（这是分层的回报）

```js
// auth-service.test.js（Node 直接跑，无需浏览器）
import { authService } from './auth-service.js';
// 依赖 http 可注入 mock；signal 可直接 set/get 断言
```

- Service 无 DOM 依赖 → 可在 Node / CI 单测。
- 依赖的外部调用（http）建议通过构造参数注入，便于 mock。
- 业务计算放纯函数到 `utils/`，Service 只做编排。

## 七、命名与目录

- 文件：`services/<name>-service.js`。
- 类：`<Name>Service`；单例：`export const <name>Service = new <Name>Service()`。
- 一个 Service 一个关注点：`auth-service`、`table-service`、`router-service`，不要「万能 service」。
