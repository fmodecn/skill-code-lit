/**
 * page/app.js —— 页面层（page）：Lit 无构建页面，组合 <quote-calc>（wc）。
 *
 * 页面层才持有「业务页面状态 + 接口地址 + 布局」。组件库只提供 <quote-calc>。
 */
import { LitElement, html, css } from 'lit';
import { quote } from '../core/index.js';
import { createBrowserTransport } from '../wc/browser-transport.js';
import '../wc/index.js';                 // 注册 <quote-calc>

export class AppRoot extends LitElement {
  static properties = { _log: { state: true } };

  static styles = css`
    :host { display: block; max-width: 720px; margin: 32px auto; padding: 0 16px; }
    h1 { font-size: 20px; }
    .demo { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    pre { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; overflow: auto; max-height: 260px; }
    .hint { color: #718096; font-size: 12px; }
  `;

  constructor() {
    super();
    this._log = [];
    this._items = [
      { sku: 'FM-PRINT-A3', price: 12.5, qty: 20 },
      { sku: 'FM-FRAME-W', price: 88, qty: 2 },
    ];
  }

  firstUpdated() {
    // 宿主注入 I/O：换成 createBrowserTransport({ endpoint: '/api/quote' }) 即走真实接口
    this._calc = this.renderRoot.querySelector('quote-calc');
    // 演示：本地 transport（用 core 算），模拟一次网络往返
    this._calc.transport = {
      call: async (input) => {
        await new Promise((r) => setTimeout(r, 150));
        return quote(input.items, { discount: input.discount || 0 });
      },
    };
  }

  render() {
    return html`
      <h1>core → wc → page 示例</h1>
      <p class="hint">
        core（纯 ESM，Node 可测）提供报价计算；&lt;quote-calc&gt;（Web Component）只做交互；
        本页面组合二者。另开 <code>plain.html</code> 可看到同一组件在纯 HTML（无框架）里运行。
      </p>
      <div class="demo">
        <quote-calc .items=${this._items} discount="0.05"
                    @quote-done=${(e) => this.#logEvent('quote-done', e.detail)}
                    @quote-error=${(e) => this.#logEvent('quote-error', e.detail)}>
          <span slot="title">Lit 页面里的报价组件</span>
        </quote-calc>
        <div>
          <strong>事件日志</strong>
          <pre>${this._log.join('\n') || '（点击「计算报价」后出现）'}</pre>
        </div>
      </div>
    `;
  }

  #logEvent(name, detail) {
    const line = `[${name}] ${JSON.stringify(detail)}`;
    this._log = [line, ...this._log].slice(0, 20);
  }
}

// 注册幂等：同一页面重复加载不抛 NotSupportedError
if (!customElements.get('app-root')) customElements.define('app-root', AppRoot);
