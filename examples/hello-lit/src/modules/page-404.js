/**
 * modules/page-404.js —— 兜底页。
 */
import { LitElement, html, css } from 'lit';
import { navigate } from '../utils/router.js';

export class Page404 extends LitElement {
  static styles = css`
    :host { display: block; padding: 24px; }
    button { margin-top: 12px; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; }
  `;

  render() {
    return html`
      <h2>404</h2>
      <p>页面不存在。</p>
      <button @click=${() => navigate('/')}>回首页</button>
    `;
  }
}

customElements.define('page-404', Page404);
