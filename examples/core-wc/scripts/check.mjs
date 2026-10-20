#!/usr/bin/env node
/**
 * scripts/check.mjs —— examples/core-wc 静态体检。
 *
 * 断言三件事（对应规则仓 core-library / web-component-library 的红线）：
 *  1. core/ 零浏览器依赖、不 import lit；
 *  2. wc/ 无装饰器；
 *  3. 全仓 .js 语法通过 + 相对 import 都带 .js。
 *
 * 用法：node scripts/check.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? `\n    ${detail}` : ''}`);
  if (!ok) fail++;
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(root);

/** 去掉注释与字符串字面量，避免把文档里提到的 window/fetch 误判为代码。 */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // 块注释
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')  // 行注释（避开 https://）
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")   // 单引号串
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');  // 双引号串
}

// 1. core 零浏览器依赖
const DOM_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator|HTMLElement|CustomEvent)\b|\bfetch\s*\(/;
const coreFiles = files.filter((f) => f.includes('/core/'));
check('core/ 目录非空', coreFiles.length > 0);
let domHits = [];
for (const f of coreFiles) {
  const src = strip(readFileSync(f, 'utf8'));
  const m = src.match(DOM_GLOBALS);
  if (m) domHits.push(`${f}: ${m[0]}`);
}
check('core/ 无浏览器全局（window/document/fetch/…）', domHits.length === 0, domHits.join('\n    '));

const litHits = coreFiles.filter((f) => /from\s+['"]lit(-html|-element)?['"]/.test(strip(readFileSync(f, 'utf8'))));
check('core/ 不 import lit', litHits.length === 0, litHits.join('\n    '));

// 2. wc 无装饰器
const DECORATOR = /^\s*@(customElement|property|state|consume|provide|query|queryAssignedElements)\b/m;
const decoHits = files.filter((f) => DECORATOR.test(strip(readFileSync(f, 'utf8'))));
check('全仓无装饰器语法', decoHits.length === 0, decoHits.join('\n    '));

// 3. 语法 + 相对 import 带 .js
let syntaxBad = [];
const suffixBad = [];
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch { syntaxBad.push(f); }
  const src = strip(readFileSync(f, 'utf8'));
  for (const m of src.matchAll(/\bfrom\s+['"](\.[^'"]*)['"]/g)) {
    if (!/\.js$/.test(m[1]) && !/\{\}/.test(m[1])) suffixBad.push(`${f}: ${m[1]}`);
  }
  // 裸标识符 import（非相对、非 node:）必须能进 importmap
  for (const m of src.matchAll(/\bfrom\s+['"]([^.'"][^'"]*)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith('node:')) continue;
    if (!/^(lit|lit-html|lit-element|@lit\/|@lit-labs\/|signal-polyfill|\/)/.test(spec)) {
      suffixBad.push(`${f}: 裸标识符 ${spec} 未列入 importmap 白名单`);
    }
  }
}
check('全部 .js 通过 node --check', syntaxBad.length === 0, syntaxBad.join('\n    '));
check('相对 import 带 .js 且裸标识符在 importmap 内', suffixBad.length === 0, suffixBad.join('\n    '));

// 4. 注册幂等
const defs = files.filter((f) => /customElements\.define\(/.test(readFileSync(f, 'utf8')));
const guarded = defs.filter((f) => /customElements\.get\(/.test(readFileSync(f, 'utf8')));
check('customElements.define 均有 get() 判重', defs.length > 0 && defs.length === guarded.length,
  defs.filter((f) => !guarded.includes(f)).join('\n    '));

console.log(fail === 0 ? '\nCHECK OK' : `\nCHECK FAILED（${fail}）`);
process.exit(fail === 0 ? 0 : 1);
