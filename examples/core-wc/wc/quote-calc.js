/**
 * wc/quote-calc.js —— 组件库（wc）：<quote-calc> 自定义元素。
 *
 * 定位：仅浏览器交互层。逻辑（算钱）来自 core `quote()`；I/O 由宿主注入 transport。
 * 契约（跨框架就靠这几样）：
 *   属性 : items(Array, property)、discount(Number, attribute)、disabled(Boolean, attribute)
 *   事件 : quote-done / quote-error（bubbles + composed，穿透 Shadow DOM）
 *   插槽 : <span slot="title"> 覆盖标题
 *   主题 : CSS 变量 --qc-accent / --qc-bg；对外结构用 ::part()
 *
 * 无构建铁律：无装饰器 —— static properties + customElements.define()（判重）。
 * 不 import 任何业务 services/routes；不直接 fetch。
 */
import { LitElement, html, css } from 'lit';
import { quote, formatMoney } from '../core/index.js';   // ← 核心库（core）

export class QuoteCalc extends LitElement {
  static properties = {
    items: { type: Array },                 // 复杂值走 property（.items=${...}）
    discount: { type: Number },             // 简单值可走 attribute（discount="0.1"）
    disabled: { type: Boolean, reflect: true },
    _result: { state: true },               // 内部渲染状态
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      --qc-accent: #2b6cb0;
      --qc-bg: #fff;
      --qc-border: #e2e8f0;
      font: 14px/1.5 system-ui, sans-serif;
    }
    .card { background: var(--qc-bg); border: 1px solid var(--qc-border); border-radius: 10px; padding: 14px; }
    h3 { margin: 0 0 10px; font-size: 15px; }
    button { background: var(--qc-accent); color: #fff; border: 0; border-radius: 6px; padding: 7px 14px; cursor: pointer; }
    button[disabled] { opacity: .5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    td { padding: 4px 0; }
    td.r { text-align: right; }
    .total { font-weight: 700; border-top: 1px solid var(--qc-border); }
    .err { color: #c53030; margin-top: 8px; }
  `;

  #transport = null;

  constructor() {
    super();
    this.items = [];
    this.discount = 0;
    this.disabled = false;
    this._result = null;
    this._busy = false;
    this._error = '';
  }

  /** 宿主注入 I/O（如 createBrowserTransport()）；未注入时本地用 core 计算。 */
  set transport(t) { this.#transport = t; }
  get transport() { return this.#transport; }

  render() {
    const busy = this._busy || this.disabled;
    const cur = this._result?.currency ?? '¥';
    return html`
      <div class="card">
        <h3><slot name="title">报价</slot></h3>

        <table part="lines">
          ${(this.items || []).map((it) => html`
            <tr>
              <td>${it.sku} × ${it.qty}</td>
              <td class="r">${formatMoney(it.price * it.qty, cur)}</td>
            </tr>
          `)}
        </table>

        <p>
          <button ?disabled=${busy} @click=${this.#onCalc}>${busy ? '计算中…' : '计算报价'}</button>
          <span class="disc">折扣：${Math.round((this.discount || 0) * 100)}%</span>
        </p>

        ${this._result ? html`
          <table part="result">
            <tr><td>小计</td><td class="r">${formatMoney(this._result.subtotal, cur)}</td></tr>
            <tr><td>优惠</td><td class="r">-${formatMoney(this._result.discount, cur)}</td></tr>
            <tr><td>税</td><td class="r">${formatMoney(this._result.tax, cur)}</td></tr>
            <tr class="total"><td>合计</td><td class="r">${formatMoney(this._result.total, cur)}</td></tr>
          </table>
        ` : ''}

        ${this._error ? html`<p class="err" part="error" role="alert">${this._error}</p>` : ''}
      </div>
    `;
  }

  async #onCalc() {
    this._error = '';
    this._busy = true;
    try {
      // 未注入 transport → 本地用 core（演示模式）；真实宿主会注入 transport
      const result = this.#transport
        ? await this.#transport.call({ items: this.items, discount: this.discount })
        : quote(this.items, { discount: this.discount });

      this._result = result;
      /** 子 → 父：语义事件，composed 穿透 Shadow DOM */
      this.dispatchEvent(new CustomEvent('quote-done', {
        detail: { result },
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      this._error = err.message || '计算失败';
      this.dispatchEvent(new CustomEvent('quote-error', {
        detail: { code: err.code, message: this._error },
        bubbles: true,
        composed: true,
      }));
    } finally {
      this._busy = false;
    }
  }
}

// 注册幂等：同一页面重复加载不抛 NotSupportedError
if (!customElements.get('quote-calc')) customElements.define('quote-calc', QuoteCalc);
