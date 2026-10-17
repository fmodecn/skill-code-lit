/**
 * components/side-menu.js —— 侧边菜单；只导航，不进业务。
 */
import { LitElement, html, css } from 'lit';
import { navigate } from '../utils/router.js';

export class SideMenu extends LitElement {
  static styles = css`
    :host { display: block; }
    h1 { font-size: 15px; margin: 0 0 12px; color: var(--brand); }
    a { display: block; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    a:hover { background: var(--bg); }
  `;

  render() {
    return html`
      <h1>Hello Lit</h1>
      <a @click=${() => navigate('/')}>首页</a>
      <a @click=${() => navigate('/users')}>用户列表</a>
    `;
  }
}

customElements.define('side-menu', SideMenu);
