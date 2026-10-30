#!/usr/bin/env node
/**
 * check-elements.mjs —— 校验 src/ 下所有自定义元素都显式声明了 display
 *
 * 背景：light DOM / Shadow DOM 下自定义元素都是「未知元素」，浏览器默认按 inline 处理，
 * 不吃 height/width、不形成块级盒子，常见症状是 h-full / flex-1 全失效、高度链断裂。
 * 规则见 SKILL.md「多页面开发铁律 · 死线4」。
 *
 * 用法：
 *   node scripts/check-elements.mjs [srcDir]      # 默认 ./src
 *
 * 判定：
 *   1. 收集源码中 customElements.define('tag', ...) 注册的全部标签；
 *   2. 在 .css 文件与内联 <style> 中查找该标签的选择器块；
 *   3. 选择器块含 display 声明 → 通过；写 `display: skip` 标记为例外（如自带 flex 布局的元素）；
 *   4. 未声明 → 报错，退出码 1。
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = process.argv[2] || 'src';
if (!existsSync(SRC)) {
  console.error(`✗ 目录不存在：${SRC}`);
  process.exit(2);
}

/** 递归收集文件 */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html|css|jsx|tsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const defined = new Set();       // customElements.define 注册的标签
let cssText = '';

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/customElements\.define\(\s*['"]([\w-]+)['"]/g)) defined.add(m[1]);
  if (extname(f) === '.css') cssText += '\n' + text;
  // 内联 <style> 块
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) cssText += '\n' + m[1];
}

/** 在 cssText 中查找某个标签的样式块（tag { ... }、tag[attr] { ... }、逗号分组 a, tag { ... }） */
function findRules(tag) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const rules = [];
  for (const m of cssText.matchAll(re)) {
    const selectors = m[1].split(',').map((s) => s.trim());
    const hit = selectors.some((s) => new RegExp(`(^|[\\s>+~:.#\\[])${tag}(?![\\w-])`).test(s));
    if (hit) rules.push(m[2]);
  }
  return rules;
}

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';
let bad = 0, skipped = 0, ok = 0;

// 只检查「已注册的自定义元素」—— 未知/拼错的标签不归本检查管
const tags = [...defined];

for (const tag of tags.sort()) {
  const rules = findRules(tag);
  const declared = rules.some((r) => /display\s*:/.test(r));
  const exempted = rules.some((r) => /display\s*:\s*skip/.test(r));
  if (exempted) { skipped++; console.log(`${YELLOW}-${RESET} ${tag} ${DIM}(例外声明 display: skip)${RESET}`); }
  else if (declared) ok++;
  else { bad++; console.log(`${RED}✗${RESET} ${tag} 未声明 display  —  add: ${tag} { display: block; min-width: 0; }`); }
}

console.log(`\n自定义元素 ${tags.length} 个：${GREEN}已声明 ${ok}${RESET}，${YELLOW}例外 ${skipped}${RESET}，${bad ? RED + '未声明 ' + bad : '未声明 0'}${RESET}`);
console.log(bad ? `${RED}CHECK FAILED${RESET}` : `${DIM}回滚显示/高度链相关白屏时，先看这些元素是否 inline。${RESET}`);
process.exit(bad ? 1 : 0);
