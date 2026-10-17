# 后台多标签 + KeepAlive

> 同一 `index.html` 内前端路由切换**不刷新页面**；KeepAlive 用 `display:none` 隐藏非激活页容器，
> **组件实例常驻**，表单 / 内部状态不丢失。对标后台管理系统的多 Tab 工作区。

## 一、核心思路

```
根组件维护 tabs 数组 → 渲染所有已打开标签页的容器
每个标签页由一个「路由判断激活」的 display 控制显隐
激活的标签 display:block，非激活 display:none（组件不销毁）
```

- **不销毁 = 状态保留**：组件实例一直在 DOM 里，`@state` 里的表单值、滚动位置都在。
- **不是 `<iframe>` / 不是多页**：单页应用，只是同页多容器。

## 二、tabsService（状态）

```js
// services/tabs-service.js
import { signal } from '@lit-labs/signals';

class TabsService {
  #tabs = signal([
    { id: 'home', path: '/', title: '首页', closable: false },
  ]);
  #activeId = signal('home');

  get tabs() { return this.#tabs; }
  get activeId() { return this.#activeId; }

  /** 打开（或激活已存在的）标签：同 path 不重复开 */
  open({ id, path, title, closable = true }) {
    const list = this.#tabs.get();
    if (!list.some((t) => t.id === id)) {
      this.#tabs.set([...list, { id, path, title, closable }]);
    }
    this.#activeId.set(id);
  }

  close(id) {
    const list = this.#tabs.get().filter((t) => t.id !== id);
    this.#tabs.set(list);
    if (this.#activeId.get() === id && list.length) {
      this.#activeId.set(list[list.length - 1].id);
    }
  }

  activate(id) { this.#activeId.set(id); }
}

export const tabsService = new TabsService();
```

## 三、tabs-container（渲染 + KeepAlive 容器）

```js
// components/tabs-container.js
import { LitElement, html, css } from 'lit';
import { SignalWatcher } from '@lit-labs/signals';
import { tabsService } from '../services/tabs-service.js';

export class TabsContainer extends SignalWatcher(LitElement) {
  static styles = css`
    .pane { display: none; }
    .pane.active { display: block; }
  `;

  render() {
    const tabs = tabsService.tabs.get();
    const activeId = tabsService.activeId.get();
    return html`
      <!-- 所有已打开标签页的容器常驻；仅激活的显示 -->
      ${tabs.map((t) => html`
        <div class="pane ${t.id === activeId ? 'active' : ''}" data-tab="${t.id}">
          <page-router-view .route=${t.path} .active=${t.id === activeId}></page-router-view>
        </div>
      `)}
    `;
  }
}
```

要点：
- 用 `display:none/block` 控制显隐，**不要**用条件渲染（`? :` 会销毁实例）。
- 每个 pane 内容由 `route` 决定渲染哪个页面组件。
- 页面组件可在 `active` 变化时决定是否暂停轮询 / 动画（省资源）。

## 四、标签栏 UI（tabs-bar）

```js
// components/tabs-bar.js
export class TabsBar extends SignalWatcher(LitElement) {
  render() {
    return html`
      <nav>
        ${tabsService.tabs.get().map((t) => html`
          <a class=${t.id === tabsService.activeId.get() ? 'on' : ''}
             @click=${() => tabsService.activate(t.id)}>
            ${t.title}
            ${t.closable ? html`<button @click=${(e) => { e.stopPropagation(); tabsService.close(t.id); }}>×</button>` : ''}
          </a>
        `)}
      </nav>
    `;
  }
}
```

## 五、与路由联动

路由命中新路径时打开/激活对应标签：

```js
// 在 route change handler
tabsService.open({
  id: path,            // 用 path 做唯一 id（也可带参数合成）
  path,
  title: routeTitle(path),
});
```

- 同 path → 仅激活（不重复开）。
- 带参数的路由（`/users/:id`）用「实际路径」做 id，`/users/1` 与 `/users/2` 是两个标签。

## 六、KeepAlive 的「刷新」语义

- **刷新单个标签**：给 pane 换一个 `key`（强制重建该子组件）——用 Lit 的 `repeat()` + 改变 key，或临时移除再插回。
- **关闭标签**：从 `tabs` 移除 → 容器消失 → 实例被 GC，状态释放。
- **整页刷新**：浏览器级 `location.reload()`，所有标签重置。

## 七、性能与注意

- 标签数量多时，非激活 pane 里的定时器 / 动画应暂停（监听 `active` 属性）。
- 大列表页面全部常驻会占内存 —— 对「重量级页面」可选用「关闭即销毁 + 重进重建」策略，或对非激活 pane 做懒初始化（首次激活才渲染内容）。
- 事件在非激活 pane 里仍会冒泡（DOM 存在）——注意别让隐藏 pane 的全局监听重复响应；用 `active` 守卫。
