#!/usr/bin/env node
/**
 * new.mjs —— 生成单个 Lit 无构建单元（组件 / 服务 / 页面 / 核心库 / 组件库）。
 *
 * 用法：
 *   node new.mjs component user-card         [--dir src/components]
 *   node new.mjs service   auth-service      [--dir src/services]
 *   node new.mjs page      page-order-list   [--dir src/routes]
 *   node new.mjs core      pricing           [--dir lib/core]   # 纯 ESM 逻辑模块（零 DOM）
 *   node new.mjs wc        quote-calc        [--dir lib/wc]     # Web Component（跨框架组件库）
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
  core: { dir: 'lib/core', file: (n) => n + '.js' },          // 纯 ESM 核心库（零浏览器依赖）
  wc: { dir: 'lib/wc', file: (n) => n + '.js' },              // Web Component 组件库
};

if (!kind || !KINDS[kind] || !name) {
  console.error(`用法：node new.mjs <component|service|page|core|wc> <name> [--dir <dir>] [--force]`);
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
const tag = (kind === 'service' || kind === 'core') ? null : (fileBase.includes('-') ? fileBase : 'x-' + fileBase);
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
} else if (kind === 'core') {
  content = `/**
 * ${pascal} —— 核心库模块（core）：纯 ESM、零浏览器依赖。
 *
 * 铁律：不碰 window/document/localStorage/fetch，不 import lit。
 * 不确定输入（时间/id/网络）一律从参数注入 → Node 可确定化单测。
 * 规则：见 .claude/rules/core-library.md
 */

/**
 * @param {any[]} items
 * @param {{ now?: () => number, id?: () => string }} [opts]
 */
export function ${pascal.charAt(0).toLowerCase() + pascal.slice(1)}(items, opts = {}) {
  const { now = () => Date.now(), id = () => Math.random().toString(36).slice(2, 10) } = opts;
  // TODO: 纯逻辑（校验 / 计算 / 状态机），全部由入参决定
  return { id: id(), at: now(), count: Array.isArray(items) ? items.length : 0 };
}
`;
} else if (kind === 'wc') {
  content = `/**
 * ${pascal} —— 组件库（Web Component）：仅浏览器交互，逻辑来自 core。
 *
 * ⚠️ 必须用 Lit 框架特性实现（extends LitElement + html + css），禁止手写原生 wc
 *    （extends HTMLElement / attachShadow() / 手写 observedAttributes）。
 *    Lit 本身基于 Web Component 标准，产物仍是跨框架可用的自定义元素。
 *
 * 契约：语义属性 + composed 事件 + slot + CSS 变量 + ::part
 * 无装饰器：static properties + customElements.define（判重）
 * 规则：见 .claude/rules/web-component-library.md
 */
import { LitElement, html, css } from 'lit';

export class ${pascal} extends LitElement {
  static properties = {
    label: { type: String },
    value: { type: Object },
    disabled: { type: Boolean, reflect: true },
    _state: { state: true },
  };

  static styles = css\`
    :host { display: block; --x-accent: #2b6cb0; }
    button { background: var(--x-accent); color: #fff; border: 0; border-radius: 6px; padding: 6px 12px; }
  \`;

  /** 宿主注入 I/O（组件库不自己 fetch） */
  #transport = null;
  set transport(t) { this.#transport = t; }
  get transport() { return this.#transport; }

  constructor() {
    super();
    this.label = '';
    this.value = null;
    this.disabled = false;
    this._state = 'idle';
  }

  render() {
    return html\`
      <button part="button" ?disabled=\${this.disabled || this._state !== 'idle'}
              @click=\${this.#onClick}>
        <slot name="label">\${this.label}</slot>
      </button>
    \`;
  }

  async #onClick() {
    this._state = 'busy';
    try {
      // 逻辑应由 core 提供；这里仅演示接线
      const result = this.#transport ? await this.#transport.call(this.value) : this.value;
      this.dispatchEvent(new CustomEvent('${tag}-done', {
        detail: { result }, bubbles: true, composed: true,
      }));
    } catch (err) {
      this.dispatchEvent(new CustomEvent('${tag}-error', {
        detail: { code: err.code, message: err.message }, bubbles: true, composed: true,
      }));
    } finally {
      this._state = 'idle';
    }
  }
}

if (!customElements.get('${tag}')) customElements.define('${tag}', ${pascal});
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
