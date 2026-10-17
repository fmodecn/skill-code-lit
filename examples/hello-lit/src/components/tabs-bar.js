/**
 * components/tabs-bar.js —— 多标签栏：激活 / 关闭。
 */
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { tabsService } from '../services/tabs-service.js';
import { navigate } from '../utils/router.js';

export class TabsBar extends SignalWatcher(LitElement) {
  static styles = css`
    :host { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--border); background: #fff; }
    .tab { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 13px; }
    .tab.on { border-color: var(--brand); color: var(--brand); }
    button { border: 0; background: none; cursor: pointer; color: #999; }
  `;

  render() {
    const activeId = tabsService.activeId.get();
    return html`
      ${tabsService.tabs.get().map((t) => html`
        <span class="tab ${t.id === activeId ? 'on' : ''}"
              @click=${() => { tabsService.activate(t.id); navigate(t.path); }}>
          ${t.title}
          ${t.closable
            ? html`<button @click=${(e) => { e.stopPropagation(); tabsService.close(t.id); }}>×</button>`
            : ''}
        </span>
      `)}
    `;
  }
}

customElements.define('tabs-bar', TabsBar);
