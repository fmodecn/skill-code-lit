/**
 * modules/user/user-service.js —— 用户模块服务。
 * 真实项目用 http；示例用内存数据，保持零后端可跑。
 */
import { signal } from '@lit-labs/signals';

class UserService {
  #users = signal([
    { id: 1, name: '张三', role: 'admin' },
    { id: 2, name: '李四', role: 'editor' },
    { id: 3, name: '王五', role: 'viewer' },
  ]);

  get users() { return this.#users; }

  findById(id) {
    return this.#users.get().find((u) => String(u.id) === String(id)) ?? null;
  }

  async fetchList() {
    // 真实项目：return (await http.get('/users')).items;
    return this.#users.get();
  }

  update(id, patch) {
    this.#users.set(this.#users.get().map((u) => (String(u.id) === String(id) ? { ...u, ...patch } : u)));
  }
}

export const userService = new UserService();
