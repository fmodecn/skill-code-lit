/**
 * services/tabs-service.js —— 多标签 + KeepAlive 的状态。
 * 用 signal 持有标签数组与激活项，容器按此渲染并 display 切换。
 */
import { signal } from '@lit-labs/signals';

class TabsService {
  #tabs = signal([{ id: '/', path: '/', title: '首页', closable: false }]);
  #activeId = signal('/');

  get tabs() { return this.#tabs; }
  get activeId() { return this.#activeId; }

  /** 打开或激活标签：同 id 不重复开 */
  open({ id, path, title, closable = true }) {
    const list = this.#tabs.get();
    if (!list.some((t) => t.id === id)) {
      this.#tabs.set([...list, { id, path, title, closable }]);
    }
    this.#activeId.set(id);
  }

  activate(id) { this.#activeId.set(id); }

  close(id) {
    const list = this.#tabs.get().filter((t) => t.id !== id);
    this.#tabs.set(list);
    if (this.#activeId.get() === id && list.length) {
      this.#activeId.set(list[list.length - 1].id);
    }
  }
}

export const tabsService = new TabsService();
