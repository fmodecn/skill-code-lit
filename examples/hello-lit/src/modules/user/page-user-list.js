/**
 * modules/user/page-user-list.js —— 用户列表页。
 * 演示：读模块 service 的 signal；点击行 → 路由跳详情；本地筛选框演示 KeepAlive 保状态。
 */
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { userService } from './user-service.js';
import { navigate } from '../../utils/router.js';

export class PageUserList extends SignalWatcher(LitElement) {
  static properties = {
    /** 组件本地 UI 状态：用 Lit property/state，不用全局 signal（无构建下无装饰器） */
    keyword: { type: String, state: true },
  };

  constructor() {
    super();
    this.keyword = '';
  }

  static styles = css`
    :host { display: block; }
    input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; max-width: 560px; background: #fff; }
    th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; font-size: 14px; }
    tr { cursor: pointer; }
    tr:hover td { background: var(--bg); }
  `;

  render() {
    const kw = this.keyword.trim().toLowerCase();
    const list = userService.users.get().filter((u) => !kw || u.name.toLowerCase().includes(kw));
    return html`
      <h2>用户列表</h2>
      <input placeholder="按姓名筛选…"
             .value=${this.keyword}
             @input=${(e) => { this.keyword = e.target.value; }} />
      <table>
        <thead><tr><th>ID</th><th>姓名</th><th>角色</th></tr></thead>
        <tbody>
          ${list.map((u) => html`
            <tr @click=${() => navigate('/users/' + u.id)}>
              <td>${u.id}</td><td>${u.name}</td><td>${u.role}</td>
            </tr>
          `)}
        </tbody>
      </table>
      ${list.length === 0 ? html`<p>无匹配用户。</p>` : ''}
    `;
  }
}

customElements.define('page-user-list', PageUserList);
