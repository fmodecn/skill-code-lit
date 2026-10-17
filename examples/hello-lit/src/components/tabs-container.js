/**
 * components/tabs-container.js —— KeepAlive 容器。
 * 渲染所有已打开标签的 pane，仅激活的 display:block，其余 display:none（实例常驻）。
 */
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { tabsService } from '../services/tabs-service.js';
import './page-view.js';   // <page-view> 由本容器渲染，须在此注册

export class TabsContainer extends SignalWatcher(LitElement) {
  static styles = css`
    :host { display: block; padding: 16px; }
    .pane { display: none; }
    .pane.active { display: block; }
  `;

  render() {
    const tabs = tabsService.tabs.get();
    const activeId = tabsService.activeId.get();
    return html`
      ${tabs.map((t) => html`
        <div class="pane ${t.id === activeId ? 'active' : ''}">
          <page-view .path=${t.path}></page-view>
        </div>
      `)}
    `;
  }
}

customElements.define('tabs-container', TabsContainer);
