#!/usr/bin/env node
/**
 * scaffold.mjs —— 生成 Lit 原生 ESM 无构建项目骨架。
 *
 * 用法：
 *   node scaffold.mjs <targetDir> [--project <name>] [--force]
 *
 * 原则：已存在的文件默认不覆盖；不引入任何构建工具；所有代码无装饰器。
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const args = process.argv.slice(2);
const target = resolve(args.find((a) => !a.startsWith('--')) || '.');
const force = args.includes('--force');
const projIdx = args.indexOf('--project');
const project = projIdx > -1 ? args[projIdx + 1] : basename(target);

if (!project || !/^[a-z0-9][a-z0-9-]*$/.test(project)) {
  console.error(`✗ 项目名非法：${project}（须为小写 kebab-case）`);
  process.exit(2);
}

let created = 0, skipped = 0;
function write(rel, content) {
  const p = join(target, rel);
  if (existsSync(p) && !force) { skipped++; console.log(`  skip  ${rel}（已存在）`); return; }
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
  created++; console.log(`  write ${rel}`);
}

const DEP_VERSIONS = {
  lit: '3.3.3', 'lit-html': '3.3.3', 'lit-element': '4.2.2', '@lit/reactive-element': '2.1.2',
  '@lit/context': '1.1.6', '@lit-labs/signals': '0.3.0', 'signal-polyfill': '0.2.2',
};

console.log(`\n生成 Lit 无构建项目：${target}\n项目名：${project}\n`);

// 目录
for (const d of ['src/components', 'src/services', 'src/utils', 'src/routes']) {
  mkdirSync(join(target, d), { recursive: true });
}

// index.html
write('src/index.html', `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${project}</title>
  <!-- 二级子路径部署必须；根部署可改 "/" -->
  <base href="/${project}/" />
  <!-- 生产：指向 FMODE Repose 公共 importmap -->
  <script type="importmap" src="/npm/importmap/lit-v3.json"></script>
  <!-- 本地无 Repose 时改用： <script type="importmap" src="./importmap.json"></script> -->
  <style>:root{--brand:#2b6cb0;--bg:#f7fafc;--border:#e2e8f0;font-family:system-ui,sans-serif}body{margin:0}</style>
</head>
<body>
  <app-root></app-root>
  <script type="module" src="./app.js"></script>
</body>
</html>
`);

// importmap.json（本地开发用）
write('src/importmap.json', JSON.stringify({
  _comment: '本地开发用；生产由 FMODE Repose 的 /npm/importmap/lit-v3.json 提供。',
  imports: {
    lit: `/npm/lit/v${DEP_VERSIONS.lit}/lit.js`,
    'lit/': `/npm/lit/v${DEP_VERSIONS.lit}/`,
    'lit-html': `/npm/lit-html/v${DEP_VERSIONS['lit-html']}/lit-html.js`,
    'lit-element': `/npm/lit-element/v${DEP_VERSIONS['lit-element']}/lit-element.js`,
    '@lit/reactive-element': `/npm/@lit/reactive-element/v${DEP_VERSIONS['@lit/reactive-element']}/reactive-element.js`,
    '@lit/context': `/npm/@lit/context/v${DEP_VERSIONS['@lit/context']}/index.js`,
    '@lit-labs/signals': `/npm/@lit-labs/signals/v${DEP_VERSIONS['@lit-labs/signals']}/index.js`,
    'signal-polyfill': `/npm/signal-polyfill/v${DEP_VERSIONS['signal-polyfill']}/dist/index.js`,
  },
}, null, 2) + '\n');

// app.js
write('src/app.js', `/**
 * app.js —— 应用装配：provide 全局服务 + 挂载路由 + 根组件。不含业务逻辑。
 */
import { LitElement, html, css } from 'lit';
import { provide } from '@lit/context';
import { authContext } from './services/contexts.js';
import { authService } from './services/auth-service.js';

export class AppRoot extends LitElement {
  static styles = css\`:host{display:block;background:var(--bg)}\`;
  render() {
    return html\`
      \${provide(authContext, authService)}
      <app-shell></app-shell>
    \`;
  }
}
customElements.define('app-root', AppRoot);
`);

// services/contexts.js
write('src/services/contexts.js', `/**
 * 注入令牌集中定义（令牌必须同一模块实例）。
 */
import { createContext } from '@lit/context';
export const authContext = createContext('${project}.auth');
`);

// services/auth-service.js
write('src/services/auth-service.js', `/**
 * 全局登录态（Signal Service）。纯 ESM Class，无 DOM 依赖，可单测。
 */
import { signal, computed } from '@lit-labs/signals';

class AuthService {
  #user = signal(null);
  #token = signal(localStorage.getItem('token') || '');
  get user() { return this.#user; }
  get isLoggedIn() { return computed(() => this.#user.get() != null); }
  getToken() { return this.#token.get(); }

  async login(username, password) {
    // TODO: 接真实接口
    // const { token, user } = await http.post('/auth/login', { username, password });
    const token = 'demo-token', user = { name: username };
    this.#token.set(token); this.#user.set(user);
    localStorage.setItem('token', token);
  }
  logout() { this.#token.set(''); this.#user.set(null); localStorage.removeItem('token'); }
}
export const authService = new AuthService();
`);

// utils/http.js
write('src/utils/http.js', `/**
 * 原生 fetch 薄封装。token 通过 configureHttp 注入，避免 utils 反向依赖 services。
 */
let getToken = () => '';
let onUnauthorized = () => {};
export function configureHttp({ token, unauthorized } = {}) {
  if (token) getToken = token;
  if (unauthorized) onUnauthorized = unauthorized;
}
export class HttpError extends Error {
  constructor(status, body) { super('HTTP ' + status); this.status = status; this.body = body; }
}
const BASE = '/api';
async function request(method, path, { body, headers = {}, query } = {}) {
  let url = BASE + path;
  if (query) url += '?' + new URLSearchParams(query).toString();
  const h = { 'Content-Type': 'application/json', ...headers };
  const t = getToken(); if (t) h.Authorization = 'Bearer ' + t;
  const res = await fetch(url, { method, headers: h, body: body != null ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
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
`);

// utils/router.js —— 子路径部署安全（不要用 new URL(path, baseURI)，会丢部署前缀）
write('src/utils/router.js', `/**
 * utils/router.js —— 子路径部署安全的导航（只用 History API，干净 URL）。
 *
 * ⚠️ 不要写 new URL(path, document.baseURI) 做导航：path 以 '/' 开头时，
 *   相对解析会丢掉 base 的路径前缀（/proj/users -> /users），子路径部署刷新即 404。
 *   正确做法：把应用内路径拼到 base 的 pathname 上再解析。
 *   详见规则仓 .claude/rules/routing-best-practices.md
 */
export function basePath() {
  return new URL(document.baseURI).pathname.replace(/\\/+$/, '');
}
export function resolveUrl(path) {
  const base = basePath();
  const q = path.indexOf('?'), h = path.indexOf('#');
  let cut = path.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  let p = path.slice(0, cut);
  const rest = path.slice(cut);        // 查询串 / hash 原样保留
  if (!p.startsWith('/')) p = '/' + p;
  return new URL(base + p + rest, location.origin);
}
export function navigate(path, { replace = false } = {}) {
  const url = resolveUrl(path);
  if (replace) history.replaceState({}, '', url); else history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));   // History 原生不触发
}
export function currentPath() {
  const base = basePath();
  let path = location.pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length);
  if (!path.startsWith('/')) path = '/' + path;
  return path.replace(/\\/{2,}/g, '/') || '/';   // 折叠 '//'
}
export function currentQuery() {
  return Object.fromEntries(new URLSearchParams(location.search));
}
export function href(path) { return resolveUrl(path); }   // 供真实 <a href>
`);

// components/app-shell.js —— 不用 @lit-labs/router（子路径部署会污染路由状态）
write('src/components/app-shell.js', `/**
 * 布局壳：侧边菜单 + 内容出口。多标签版本见规则仓 tabs-keepalive.md。
 *
 * ⚠️ 不用 @lit-labs/router：它装全局 <a> 拦截器且用未剥前缀的 location.pathname
 *   匹配路由，子路径部署下会污染路由状态。改为订阅 popstate + currentPath()。
 */
import { LitElement, html, css } from 'lit';
import { currentPath, navigate } from '../utils/router.js';
import './page-home.js';

const ROUTES = [{ path: '/', tag: 'page-home', title: '首页' }];

export class AppShell extends LitElement {
  static styles = css\`:host{display:block;padding:16px}\`;
  static properties = { _path: { state: true } };

  #onPop = () => { this._path = currentPath(); };

  connectedCallback() {
    super.connectedCallback();
    this._path = currentPath();
    window.addEventListener('popstate', this.#onPop);
  }
  disconnectedCallback() {
    window.removeEventListener('popstate', this.#onPop);
    super.disconnectedCallback();
  }

  render() {
    const hit = ROUTES.find((r) => r.path === this._path) || ROUTES[ROUTES.length - 1];
    return html\`
      <nav>
        \${ROUTES.map((r) => html\`<button @click=\${() => navigate(r.path)}>\${r.title}</button>\`)}
      </nav>
      <main>\${this.#view(hit)}</main>
    \`;
  }
  #view(r) { return document.createElement(r.tag); }
}
customElements.define('app-shell', AppShell);
`);

// components/page-home.js
write('src/components/page-home.js', `/**
 * 首页示例组件。无装饰器；用 static properties。
 */
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { ContextConsumer } from '@lit/context';
import { authContext } from '../services/contexts.js';

export class PageHome extends SignalWatcher(LitElement) {
  static properties = { _auth: { state: true } };
  #consumer = new ContextConsumer(this, { context: authContext, subscribe: true, callback: (v) => { this._auth = v; } });
  static styles = css\`h1{color:var(--brand)}\`;
  render() {
    const name = this._auth?.user.get()?.name;
    return html\`<h1>${project}: \${name || 'hello lit'}</h1>\`;
  }
}
customElements.define('page-home', PageHome);
`);

// package.json
write('package.json', JSON.stringify({
  name: project, private: true, type: 'module',
  _comment: 'devDependencies 仅用于 IDE 类型提示，不参与部署产物。',
  scripts: { serve: 'npx --yes serve src', deploy: 'bash scripts/deploy.sh ' + project },
  devDependencies: {
    lit: '^' + DEP_VERSIONS.lit, '@lit/context': '^' + DEP_VERSIONS['@lit/context'],
    '@lit-labs/signals': '^' + DEP_VERSIONS['@lit-labs/signals'],
  },
}, null, 2) + '\n');

// scripts/deploy.sh
write('scripts/deploy.sh', `#!/usr/bin/env bash
# 无构建部署：同步 src/ 到 OBS + CDN 刷新。凭据由环境/既有脚本提供，不写入仓库。
set -euo pipefail
PROJECT="\${1:-${project}}"
BUCKET="\${OBS_BUCKET:?需设置 OBS_BUCKET}"
EP="\${OBS_ENDPOINT:-obs.cn-south-1.myhuaweicloud.com}"
OBS="\${OBSUTIL:-/opt/data/bin/obsutil}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/src"
"$OBS" rm "$BUCKET/$PROJECT/index.html" -e="$EP" -f >/dev/null 2>&1 || true
"$OBS" cp "$SRC/index.html" "$BUCKET/$PROJECT/index.html" -e="$EP" -acl=public-read -f \\
  -meta="Cache-Control:no-cache#Content-Type:text/html; charset=utf-8"
"$OBS" sync "$SRC/" "$BUCKET/$PROJECT/" -e="$EP" -acl=public-read -f
echo "完成。确认 CDN 回退：不存在路径 200 返回 index.html（禁 302）。"
`);

// .gitignore
write('.gitignore', 'node_modules/\ndist/\n.DS_Store\n');

console.log(`\n✓ 完成：新建 ${created} 个文件，跳过 ${skipped} 个。`);
console.log(`\n下一步：`);
console.log(`  1. 本地预览： cd ${target} && npx serve src`);
console.log(`  2. 或在 index.html 指向 Repose 公共 importmap 后直接部署`);
console.log(`  3. 规则细则见 fmode-code-lit 规则仓 .claude/rules/\n`);
