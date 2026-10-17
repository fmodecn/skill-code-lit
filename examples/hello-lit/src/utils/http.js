/**
 * utils/http.js —— 原生 fetch 薄封装。
 * 无状态；token 通过 configureHttp 注入，避免 utils 反向依赖 services。
 */
let getToken = () => '';
let onUnauthorized = () => {};

/** 装配时由 app 调用，注入 token 获取与 401 处理 */
export function configureHttp({ token, unauthorized } = {}) {
  if (token) getToken = token;
  if (unauthorized) onUnauthorized = unauthorized;
}

export class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

const BASE = '/api';

async function request(method, path, { body, headers = {}, query } = {}) {
  let url = BASE + path;
  if (query) url += '?' + new URLSearchParams(query).toString();

  const h = { 'Content-Type': 'application/json', ...headers };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: h,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (res.status === 401) { onUnauthorized(); throw new HttpError(401, null); }

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
