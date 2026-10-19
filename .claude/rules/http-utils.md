# HTTP 与工具（utils）

> 用原生 `fetch` 薄封装，**不引 axios**。工具层是**纯无状态函数**，谁都能 import，不持有全局状态。

## 一、utils 的边界

| 允许 | 禁止 |
|------|------|
| 纯函数（格式化、校验、URL 拼接、深拷贝） | 持有可变全局状态 |
| 通用封装（http、storage） | import `components/` 或 `services/` |
| 依赖浏览器 API（fetch/localStorage/URL） | 依赖 Lit / DOM 渲染 |

> utils 必须可在 Node 或任意上下文 import 而不产生副作用。

## 二、HTTP 封装（utils/http.js）

```js
// utils/http.js
import { authService } from '../services/auth-service.js';

const BASE = '/api';   // 或从 config 注入

class HttpError extends Error {
  constructor(status, body) { super(`HTTP ${status}`); this.status = status; this.body = body; }
}

async function request(method, path, { body, headers = {}, query } = {}) {
  let url = BASE + path;
  if (query) url += '?' + new URLSearchParams(query).toString();

  const finalHeaders = { 'Content-Type': 'application/json', ...headers };
  const token = authService?.getToken?.();
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    authService.logout();
    // 触发跳转登录（由路由/根组件响应 signal）
    throw new HttpError(401, null);
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new HttpError(res.status, data);
  return data;
}

export const http = {
  get: (p, o) => request('GET', p, o),
  post: (p, body, o) => request('POST', p, { ...o, body }),
  put: (p, body, o) => request('PUT', p, { ...o, body }),
  del: (p, o) => request('DELETE', p, o),
};
```

设计要点：
- **token 自动注入**（从 `authService` 取）。
- **401 统一处理**：登出 + 让 UI 响应 signal 跳登录。
- **统一错误**：抛 `HttpError`，携带 `status` / `body`，调用方可 `catch`。
- **DTO 解析**按 content-type 分流。
- 循环依赖注意：`http` 引用 `authService`，`authService` 又用 `http` → 用**惰性调用**（函数内取）而非模块顶层解构，避免 ESM 循环初始化问题。

## 三、Storage 封装（utils/storage.js）

```js
export const storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); },
};
```

- 加 try/catch（隐私模式 / 配额满会抛）。
- JSON 序列化，避免手写类型转换。
- 敏感数据（token）单独考虑，不要明文长期存（见安全）。

## 四、格式化（utils/format.js）

```js
export const formatMoney = (n, currency = '¥') =>
  `${currency}${Number(n ?? 0).toFixed(2)}`;

export const formatDate = (d, fmt = 'YYYY-MM-DD') => { /* ... */ };

export const debounce = (fn, ms = 200) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
```

纯函数，无副作用，可单测。

## 五、其他常用工具

| 工具 | 用途 |
|------|------|
| `utils/router.js` | `navigate()` / `href()` / `currentPath()`（把应用内路径拼到 base 的 **pathname** 上；见 [routing-best-practices.md](./routing-best-practices.md)） |
| `utils/dom.js` | 少量原生 DOM 辅助（慎用，优先 Lit 指令） |
| `utils/validate.js` | 表单校验纯函数 |

## 六、禁止

- ❌ 在 utils 里 `import { html }`。
- ❌ 在 utils 里持有跨调用的可变状态（那属于 Service）。
- ❌ 在组件里直接 `fetch`（一律走 `http`）。
- ❌ 手写重复的 URL 拼接 / 时间格式化（抽到 utils）。
