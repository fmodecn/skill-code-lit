#!/usr/bin/env node
/**
 * scripts/browser-verify.mjs —— 真实浏览器验收（本仓纪律：不能只 curl）。
 *
 * 覆盖：组件注册 / property 渲染 / Shadow DOM 样式隔离 / 事件穿透 composed /
 *       core 计算结果 / Lit 页面宿主 / 纯 HTML 宿主 / 重复 import 幂等 / 主题变量。
 *
 * 前置：
 *   1) 站点根 = examples/（页面里 <base href="/core-wc/page/">）
 *      python3 -m http.server 4000   （在 examples/ 下）
 *   2) 本地无 Repose 时，用 npm 装的 lit 并把两个 html 的 importmap 换成本地 node_modules
 *      （见 ../README.md「方式 B」）
 *   3) npm i -D playwright && npx playwright install chromium
 *
 * 用法：node scripts/browser-verify.mjs [baseURL]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:4000/core-wc';
let fail = 0;
const ok = (n, c, d = '') => { console.log(`${c ? '✓' : '✗'} ${n}${!c && d ? `\n    ${d}` : ''}`); if (!c) fail++; };

// favicon.ico 404 是无 favicon 时的必然噪音，不算失败
const isNoise = (m) => /favicon/i.test(m.location()?.url || '') || /favicon/i.test(m.text());

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// ---------- 1) 纯 HTML 宿主（无框架）----------
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m)) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(`${BASE}/wc/plain.html`, { waitUntil: 'networkidle' });
ok('plain.html 无控制台报错', errors.length === 0, errors.join('\n    '));
ok('quote-calc 已注册', await page.evaluate(() => !!customElements.get('quote-calc')));

const lines = await page.locator('quote-calc').evaluate((el) => el.shadowRoot.querySelectorAll('table[part=lines] tr').length);
ok('property 传值渲染出行（2 行）', lines === 2, `实际 ${lines}`);

const iso = await page.evaluate(() => {
  const s = document.createElement('style'); s.textContent = 'button{background:red !important}';
  document.head.appendChild(s);
  return getComputedStyle(document.querySelector('quote-calc').shadowRoot.querySelector('button')).backgroundColor;
});
ok('Shadow DOM 隔离（外部样式改不动内部按钮）', iso !== 'rgb(255, 0, 0)', `实际 ${iso}`);

const detail = await page.evaluate(async () => {
  const el = document.querySelector('quote-calc');
  return new Promise((res) => { el.addEventListener('quote-done', (e) => res(e.detail)); el.shadowRoot.querySelector('button').click(); });
});
ok('quote-done 事件穿透 Shadow DOM 且带 detail', !!detail?.result, JSON.stringify(detail));
ok('core 计算结果正确（82 小计 / 8.2 折扣）', detail?.result?.subtotal === 82 && detail?.result?.discount === 8.2, JSON.stringify(detail?.result));

// ---------- 2) Lit 页面宿主 ----------
const errs2 = []; const page2 = await browser.newPage();
page2.on('console', (m) => { if (m.type() === 'error' && !isNoise(m)) errs2.push(m.text()); });
page2.on('pageerror', (e) => errs2.push('pageerror: ' + e.message));
await page2.goto(`${BASE}/page/index.html`, { waitUntil: 'networkidle' });
ok('page/index.html 无控制台报错', errs2.length === 0, errs2.join('\n    '));
ok('Lit 页面里 app-root + quote-calc 均已注册',
  await page2.evaluate(() => !!customElements.get('app-root') && !!customElements.get('quote-calc')));

await page2.locator('quote-calc').evaluate((el) => el.shadowRoot.querySelector('button').click());
await page2.waitForTimeout(400);
const log = await page2.locator('app-root').evaluate((el) => el.shadowRoot.querySelector('pre').textContent);
ok('Lit 页面收到事件并写入日志', log.includes('quote-done'), log.slice(0, 120));

// ---------- 3) 幂等 ----------
const dup = await page.evaluate(async () => {
  try { await import('/wc/index.js'); await import('/wc/index.js'); return 'ok'; }
  catch (e) { return 'err: ' + e.message; }
});
ok('重复 import 组件库不抛 define 冲突', dup === 'ok', dup);

// ---------- 4) 主题变量 ----------
const themed = await page.evaluate(() => {
  const el = document.querySelector('quote-calc');
  el.style.setProperty('--qc-accent', 'rgb(47, 133, 90)');
  return getComputedStyle(el.shadowRoot.querySelector('button')).backgroundColor;
});
ok('CSS 变量 --qc-accent 可穿透主题', themed === 'rgb(47, 133, 90)', `实际 ${themed}`);

await browser.close();
console.log(fail === 0 ? '\nBROWSER OK' : `\nBROWSER FAILED（${fail}）`);
process.exit(fail ? 1 : 0);
