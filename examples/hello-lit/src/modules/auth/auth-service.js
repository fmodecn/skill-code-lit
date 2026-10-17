/**
 * modules/auth/auth-service.js —— 全局登录态（Signal Service）。
 * 纯 ESM Class，无 DOM 依赖，可在 Node 单测。
 */
import { signal, computed } from '@lit-labs/signals';

class AuthService {
  #user = signal(null);
  #token = signal(localStorage.getItem('token') || '');

  get user() { return this.#user; }
  get isLoggedIn() { return computed(() => this.#user.get() != null); }
  getToken() { return this.#token.get(); }

  /** 示例：本地模拟登录（真实项目走 http.post） */
  login(name = 'Demo User') {
    const token = 'demo-token';
    this.#token.set(token);
    this.#user.set({ name, roles: ['admin'] });
    localStorage.setItem('token', token);
  }

  logout() {
    this.#token.set('');
    this.#user.set(null);
    localStorage.removeItem('token');
  }
}

export const authService = new AuthService();
