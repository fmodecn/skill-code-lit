/**
 * app.js —— 应用装配入口
 * 职责：provide 全局服务 + 挂载路由 + 渲染根组件。不含业务逻辑。
 */
import { LitElement, html, css } from 'lit';
import { provide } from '@lit/context';
import { authContext } from './services/contexts.js';
import { authService } from './modules/auth/auth-service.js';

import './components/app-shell.js';

export class AppRoot extends LitElement {
  static styles = css`
    :host { display: block; background: var(--bg); }
  `;

  render() {
    return html`
      <!-- 全局注入：整棵组件树可 consume -->
      ${provide(authContext, authService)}
      <app-shell></app-shell>
    `;
  }
}

customElements.define('app-root', AppRoot);
