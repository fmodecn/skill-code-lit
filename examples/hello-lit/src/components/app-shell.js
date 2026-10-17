/**
 * components/app-shell.js —— 布局壳：侧边菜单 + 多标签栏 + KeepAlive 内容区。
 *
 * 关键：内容区不用 router.outlet()（每次路由切换会销毁重建），
 * 而是交给 <tabs-container> 渲染「所有已打开标签」的常驻容器，
 * 路由只负责「打开/激活标签」。
 */
import { LitElement, html, css } from 'lit';
import { Router } from '@lit-labs/router';
import { SignalWatcher } from '@lit-labs/signals';
import { tabsService } from '../services/tabs-service.js';
import { currentPath } from '../utils/router.js';

import './side-menu.js';
import './tabs-bar.js';
import './tabs-container.js';

/** 路由表：path 模式 → 标签标题（供打开标签时命名） */
const ROUTES = [
  { pattern: '/', title: '首页' },
  { pattern: '/users', title: '用户列表' },
  { pattern: '/users/:id', title: '用户详情' },
];

export class AppShell extends SignalWatcher(LitElement) {
  static styles = css`
    :host { display: grid; grid-template-columns: 200px 1fr; min-height: 100vh; }
    aside { border-right: 1px solid var(--border); padding: 12px; background: #fff; }
    main { display: flex; flex-direction: column; min-width: 0; }
  `;

  /** Router 仅用于 history 集成与 popstate 派发；渲染出口不用它 */
  #router = new Router(this, [{ path: '/*', render: () => html`` }]);

  #onPop = () => this.#syncTabWithRoute();

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this.#onPop);
    this.#syncTabWithRoute();
  }

  disconnectedCallback() {
    window.removeEventListener('popstate', this.#onPop);
    super.disconnectedCallback();
  }

  /** 路由变化 → 打开/激活标签（已存在则仅激活） */
  #syncTabWithRoute() {
    const path = currentPath();
    const title = this.#titleFor(path);
    tabsService.open({ id: path, path, title });
  }

  #titleFor(path) {
    if (path === '/') return '首页';
    if (path === '/users') return '用户列表';
    if (path.startsWith('/users/')) return `用户详情 ${path.split('/').pop()}`;
    return '页面';
  }

  render() {
    return html`
      <aside><side-menu></side-menu></aside>
      <main>
        <tabs-bar></tabs-bar>
        <tabs-container></tabs-container>
      </main>
    `;
  }
}

customElements.define('app-shell', AppShell);
