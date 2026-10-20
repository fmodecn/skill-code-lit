/**
 * wc/browser-transport.js —— 浏览器 I/O 适配器。
 *
 * 组件库（wc）不自己 fetch：网络属于「宿主环境」。
 * 这里提供一个默认 transport 给 Lit 宿主用；React/Vue 宿主可换成自己的实现。
 * 注意：这个文件**才是**碰 fetch 的地方 —— core 里一个字都不许有。
 */
export function createBrowserTransport({ endpoint = '/api/quote', headers = {} } = {}) {
  return {
    /** @param {{ items: any[], discount?: number }} input */
    async call(input) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = Object.assign(new Error(`HTTP ${res.status}`), { code: 'E_HTTP', status: res.status });
        throw err;
      }
      return res.json();
    },
  };
}

/** 无后端时的本地演示 transport：直接用 core 计算，行为与真实一致。 */
export function createEchoTransport(quoteFn) {
  return {
    async call(input) {
      await new Promise((r) => setTimeout(r, 120));   // 模拟网络延迟，好观察 loading
      return quoteFn(input.items, { discount: input.discount || 0 });
    },
  };
}
