#!/usr/bin/env node
/**
 * new.mjs —— 生成单个 Lit 无构建单元（组件 / 服务 / 页面）。
 *
 * 用法：
 *   node new.mjs component user-card         [--dir src/components]
 *   node new.mjs service   auth-service      [--dir src/services]
 *   node new.mjs page      page-order-list   [--dir src/routes]
 *
 * 生成物一律无装饰器，遵循规则仓命名与分层规范。
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const kind = args[0];
const name = args[1];
const dirIdx = args.indexOf('--dir');
const force = args.includes('--force');

const KINDS = {
  component: { dir: 'src/components', file: (n) => n + '.js' },
  service: { dir: 'src/services', file: (n) => n + '.js' },   // 文件名已含 -service 后缀
  page: { dir: 'src/routes', file: (n) => n + '.js' },
};

if (!kind || !KINDS[kind] || !name) {
  console.error(`用法：node new.mjs <component|service|page> <name> [--dir <dir>] [--force]`);
  process.exit(2);
}
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(`✗ 名称须为小写 kebab-case：${name}`);
  process.exit(2);
}

const spec = KINDS[kind];
const dir = dirIdx > -1 ? resolve(args[dirIdx + 1]) : resolve(spec.dir);
// service：允许传 order 或 order-service，统一补一个 -service 后缀（避免 order-service-service）
const baseName = kind === 'service' ? name.replace(/-service$/, '') : name;
const fileBase = kind === 'service' ? baseName + '-service' : name;
const pascal = fileBase.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
// 标签必须含连字符：page- 前缀已保证；component 若单段则补前缀
const tag = kind === 'service' ? null : (fileBase.includes('-') ? fileBase : 'x-' + fileBase);
const path = join(dir, spec.file(fileBase));
const relToUtils = kind === 'page' ? '../../utils' : '../utils';

if (existsSync(path) && !force) {
  console.error(`✗ 已存在：${path}（用 --force 覆盖）`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

let content = '';
if (kind === 'component') {
  content = `/**
 * ${name} —— 通用组件。
 * 无装饰器：static properties + customElements.define。
 */
import { LitElement, html, css } from 'lit';

export class ${pascal} extends LitElement {
  static properties = {
    label: { type: String },
  };

  static styles = css\`
    :host { display: block; }
  \`;

  constructor() { super(); this.label = ''; }

  render() {
    return html\`<div>\${this.label}</div>\`;
  }
}

customElements.define('${tag}', ${pascal});
`;
} else if (kind === 'service') {
  const endpoint = baseName;
  const singleton = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  content = `/**
 * ${pascal} —— 业务服务（Signal + 单例）。无 DOM 依赖，可单测。
 */
import { signal, computed } from '@lit-labs/signals';
// import { http } from '${relToUtils}/http.js';

class ${pascal} {
  #items = signal([]);
  get items() { return this.#items; }
  get count() { return computed(() => this.#items.get().length); }

  async fetchAll() {
    // const data = await http.get('/${endpoint}');
    // this.#items.set(data.items ?? []);
    return this.#items.get();
  }

  set(items) { this.#items.set(items); }
}

export const ${singleton} = new ${pascal}();
`;
} else {
  content = `/**
 * ${name} —— 页面组件（路由挂载）。
 */
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
// import { navigate } from '${relToUtils}/router.js';

export class ${pascal} extends SignalWatcher(LitElement) {
  static properties = {};

  static styles = css\`
    :host { display: block; }
  \`;

  render() {
    return html\`<h2>${pascal}</h2>\`;
  }
}

customElements.define('${tag}', ${pascal});
`;
}

writeFileSync(path, content);
console.log(`✓ 已生成 ${path}`);
