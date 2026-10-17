/**
 * modules/user/page-user-detail.js —— 用户详情页。演示：入参 userId 来自路由。
 */
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { userService } from './user-service.js';
import { navigate } from '../../utils/router.js';

export class PageUserDetail extends SignalWatcher(LitElement) {
  static properties = {
    userId: { type: String },
  };

  static styles = css`
    :host { display: block; }
    .card { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 16px; max-width: 420px; }
    button { margin-top: 12px; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; }
  `;

  render() {
    const u = userService.findById(this.userId);
    if (!u) return html`<h2>用户详情</h2><p>未找到用户 ${this.userId}。</p>`;
    return html`
      <h2>用户详情</h2>
      <div class="card">
        <p>ID：${u.id}</p>
        <p>姓名：${u.name}</p>
        <p>角色：${u.role}</p>
        <button @click=${() => navigate('/users')}>返回列表</button>
      </div>
    `;
  }
}

customElements.define('page-user-detail', PageUserDetail);
