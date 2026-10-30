/**
 * light-slot.js — light DOM 下替代 <slot> 的内容投影
 *
 * 用法：
 *   import { capture, project } from './light-slot.js';
 *
 *   class MyCard extends LightElement {
 *     connectedCallback() {
 *       super.connectedCallback();
 *       capture(this);              // ← 渲染前捕获外部子节点
 *     }
 *     updated() {
 *       project(this);              // ← 渲染后搬入容器（内部幂等）
 *     }
 *     render() {
 *       return html`
 *         <div class="card-header">
 *           <div data-light-slot="actions"></div>
 *         </div>
 *         <div class="card-body" data-light-slot="body"></div>
 *       `;
 *     }
 *   }
 *
 * 关键约束（违反即出 bug）：
 *  1. capture 必须在渲染前调用。渲染后再扫宿主子节点，会把组件自己刚生成的内容
 *     当成「外部传入」搬走，越搬越乱。
 *  2. project 必须靠 dataset.projected 做幂等，否则每次重渲染都重复搬、节点来回跳。
 *  3. 传入具名内容用 slot="actions" 属性；不写 slot 属性的默认进 body。
 */

const KEY = '__lightIncoming';

/**
 * 渲染前捕获宿主元素上的外部子节点
 * @param {HTMLElement} host
 */
export function capture(host) {
  const body = [];
  const named = {};
  for (const n of [...host.childNodes]) {
    // 元素节点且带 slot 属性 → 具名插槽
    if (n.nodeType === 1 && n.hasAttribute('slot')) {
      const name = n.getAttribute('slot');
      (named[name] ||= []).push(n);
    } else if (n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim())) {
      // 元素节点，或非空白文本节点 → 默认 body
      body.push(n);
    }
  }
  host[KEY] = { body, named };
}

/**
 * 渲染后把捕获的节点搬进对应容器（幂等）
 * @param {HTMLElement} host
 */
export function project(host) {
  const stash = host[KEY];
  if (!stash) return;

  // 默认插槽 → body
  const bodyBox = host.querySelector('[data-light-slot="body"]');
  if (bodyBox && !bodyBox.dataset.projected) {
    const nodes = [...stash.body, ...(stash.named.body || [])];
    for (const n of nodes) {
      if (n.parentNode === host) bodyBox.appendChild(n);
    }
    bodyBox.dataset.projected = '1';
  }

  // 具名插槽
  for (const [name, nodes] of Object.entries(stash.named)) {
    if (name === 'body') continue;
    const box = host.querySelector(`[data-light-slot="${name}"]`);
    if (box && !box.dataset.projected) {
      for (const n of nodes) {
        if (n.parentNode === host) box.appendChild(n);
      }
      box.dataset.projected = '1';
    }
  }
}
