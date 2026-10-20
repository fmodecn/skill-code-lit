/**
 * core/quote.js —— 核心库（core）：纯 ESM 报价计算。
 *
 * 铁律：不碰 window / document / localStorage / fetch，不 import lit。
 * 所有不确定输入（时间、id、费率）都从参数注入 → 可在 Node 里确定化单测。
 */

/**
 * @typedef {{ sku: string, price: number, qty: number }} Item
 * @typedef {{
 *   taxRate?: number, discount?: number, currency?: string,
 *   now?: () => number, id?: () => string,
 * }} QuoteOptions
 */

/**
 * 计算一张报价单。
 * @param {Item[]} items
 * @param {QuoteOptions} [opts]
 */
export function quote(items, opts = {}) {
  const {
    taxRate = 0.06,
    discount = 0,
    currency = '¥',
    now = () => Date.now(),
    id = () => `q-${Math.random().toString(36).slice(2, 10)}`,
  } = opts;

  if (!Array.isArray(items)) throw badInput('E_ITEMS', 'items 必须是数组');
  for (const it of items) {
    if (!(it.price >= 0) || !(it.qty >= 1) || !Number.isInteger(it.qty) || !it.sku) {
      throw badInput('E_ITEM', `无效条目：${JSON.stringify(it)}`);
    }
  }
  if (discount < 0 || discount > 1) throw badInput('E_DISCOUNT', 'discount 必须在 [0, 1]');

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const discountAmount = round2(subtotal * discount);
  const net = round2(subtotal - discountAmount);
  const tax = round2(net * taxRate);
  const total = round2(net + tax);

  return {
    id: id(),
    at: now(),
    currency,
    lines: items.map((it) => ({ sku: it.sku, qty: it.qty, amount: round2(it.price * it.qty) })),
    subtotal: round2(subtotal),
    discount: discountAmount,
    net,
    tax,
    total,
  };
}

/** 两位小数四舍五入（避免 0.1 + 0.2 类浮点尾巴）。 */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 展示用格式化；金额格式化本身也是纯函数（金额展示与业务格式耦合，常被复用）。 */
export function formatMoney(amount, currency = '¥') {
  return `${currency}${Number(amount).toFixed(2)}`;
}

function badInput(code, message) {
  return Object.assign(new Error(message), { code });
}
