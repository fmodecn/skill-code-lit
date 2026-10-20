/**
 * test/quote.test.js —— core 单测：node --test test/
 * 不依赖浏览器、不依赖 jsdom；所有不确定输入经参数注入。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, round2, formatMoney } from '../core/index.js';

const fixed = { now: () => 0, id: () => 'q-test' };

test('合计与税：四舍五入到分', () => {
  const r = quote([{ sku: 'A', price: 19.99, qty: 3 }], { taxRate: 0.06, ...fixed });
  assert.equal(r.subtotal, 59.97);
  assert.equal(r.tax, 3.6);        // 59.97 * 0.06 = 3.5982 → 3.60
  assert.equal(r.total, 63.57);
  assert.equal(r.id, 'q-test');
  assert.equal(r.at, 0);
});

test('折扣先减后计税', () => {
  const r = quote([{ sku: 'A', price: 100, qty: 2 }], { discount: 0.1, taxRate: 0.1, ...fixed });
  assert.equal(r.subtotal, 200);
  assert.equal(r.discount, 20);
  assert.equal(r.net, 180);
  assert.equal(r.tax, 18);
  assert.equal(r.total, 198);
});

test('行小计等于单价 × 数量', () => {
  const r = quote([{ sku: 'A', price: 0.1, qty: 3 }], fixed);
  assert.deepEqual(r.lines, [{ sku: 'A', qty: 3, amount: 0.3 }]);   // 0.1*3 浮点尾巴被抹平
});

test('非法输入抛带 code 的错误', () => {
  assert.throws(() => quote('x'), (e) => e.code === 'E_ITEMS');
  assert.throws(() => quote([{ sku: 'A', price: -1, qty: 1 }]), (e) => e.code === 'E_ITEM');
  assert.throws(() => quote([{ sku: 'A', price: 1, qty: 1.5 }]), (e) => e.code === 'E_ITEM');
  assert.throws(() => quote([], { discount: 2 }), (e) => e.code === 'E_DISCOUNT');
});

test('缺省 id / now 也能跑（未注入时用默认实现）', () => {
  const r = quote([{ sku: 'A', price: 1, qty: 1 }]);
  assert.match(r.id, /^q-/);
  assert.equal(typeof r.at, 'number');
});

test('工具函数', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(formatMoney(12.5), '¥12.50');
  assert.equal(formatMoney(12.5, '$'), '$12.50');
});
