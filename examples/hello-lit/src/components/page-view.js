/**
 * components/page-view.js —— 按 path 渲染对应页面组件。
 * 每个 pane 一个实例；实例常驻（KeepAlive），状态不丢。
 * 页面组件从各功能模块引入。
 */
import { LitElement, html } from 'lit';

import '../modules/home/page-home.js';
import '../modules/user/page-user-list.js';
import '../modules/user/page-user-detail.js';
import '../modules/page-404.js';

export class PageView extends LitElement {
  static properties = {
    path: { type: String },
  };

  /** 跳过 Shadow DOM，让页面组件直接参与布局（页面自带样式） */
  createRenderRoot() { return this; }

  /**
   * 每个 pane 的 path 固定不变，故此处条件渲染是稳定的：
   * 一个 pane 对应一个页面实例，随 pane 一起常驻（KeepAlive）。
   */
  render() {
    const p = this.path || '/';
    if (p === '/') return html`<page-home></page-home>`;
    if (p === '/users') return html`<page-user-list></page-user-list>`;
    if (p.startsWith('/users/')) {
      return html`<page-user-detail .userId=${p.split('/').pop()}></page-user-detail>`;
    }
    return html`<page-404></page-404>`;
  }
}

customElements.define('page-view', PageView);
