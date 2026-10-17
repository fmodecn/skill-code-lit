/**
 * modules/home/page-home.js —— 首页。
 * 演示：SignalWatcher 读全局 signal + 通过 ContextConsumer 消费注入的服务。
 *
 * ⚠️ 无构建环境下禁用装饰器语法（@consume/@state 需编译转换），
 *    一律用 static properties + 编程式 API。详见 rules/components.md。
 */
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { ContextConsumer } from '@lit/context';
import { authContext } from '../../services/contexts.js';

export class PageHome extends SignalWatcher(LitElement) {
  static properties = {
    /** 注入的 AuthService 实例；用 state 属性触发重渲染 */
    _auth: { state: true },
  };

  #authConsumer = new ContextConsumer(this, {
    context: authContext,
    subscribe: true,
    // 编程式消费：拿到的实例存入 state 属性，赋值即触发重渲染
    callback: (v) => { this._auth = v; },
  });

  static styles = css`
    :host { display: block; }
    h2 { margin-top: 0; }
    .card { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 16px; max-width: 560px; }
    code { background: var(--bg); padding: 1px 5px; border-radius: 4px; }
  `;

  render() {
    const user = this._auth?.user.get();
    return html`
      <h2>首页</h2>
      <div class="card">
        <p>欢迎，<b>${user ? user.name : '访客'}</b>。</p>
        <p>这是 <code>fmode-code-lit</code> 的无构建示例：源码即产物，刷新即见。</p>
        <p>切到「用户列表」后回来，输入框内容与状态仍保留（KeepAlive）。</p>
      </div>
    `;
  }
}

customElements.define('page-home', PageHome);
