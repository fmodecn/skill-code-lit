#!/usr/bin/env node
/**
 * smoke.mjs —— 技能自检。
 * 生成一个临时项目并校验：文件齐全、JS 语法通过、无装饰器。
 * 用法：node scripts/smoke.mjs
 */
import { mkdtempSync, rmSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scaffold = join(__dirname, 'scaffold.mjs');
const newGen = join(__dirname, 'new.mjs');

let fail = 0;
const check = (name, cond) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fail++; };

function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const dir = mkdtempSync(join(tmpdir(), 'fmode-code-lit-smoke-'));
try {
  execFileSync(process.execPath, [scaffold, dir, '--project', 'smoke-app'], { stdio: 'pipe' });
  const files = walk(dir);
  check('scaffold 生成 index.html', files.some((f) => f.endsWith('src/index.html')));
  check('scaffold 生成 importmap.json', files.some((f) => f.endsWith('src/importmap.json')));
  check('scaffold 生成 app.js', files.some((f) => f.endsWith('src/app.js')));
  check('scaffold 生成分层目录', ['components', 'services', 'utils'].every((d2) => files.some((f) => f.includes(`/src/${d2}/`))));

  execFileSync(process.execPath, [newGen, 'component', 'smoke-card', '--dir', join(dir, 'src/components')], { stdio: 'pipe' });
  execFileSync(process.execPath, [newGen, 'service', 'smoke-service', '--dir', join(dir, 'src/services')], { stdio: 'pipe' });
  check('new component 生成', files.some((f) => f.endsWith('smoke-card.js')) || walk(dir).some((f) => f.endsWith('smoke-card.js')));
  check('new service 无重复后缀', walk(dir).some((f) => f.endsWith('smoke-service.js')) && !walk(dir).some((f) => f.endsWith('smoke-service-service.js')));

  // 全量语法校验 + 装饰器扫描
  let syntaxOk = true, decoratorFound = false;
  for (const f of walk(dir).filter((f) => f.endsWith('.js'))) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch { syntaxOk = false; console.log('  语法失败:', f); }
    if (/^\s*@(customElement|property|state|consume|provide|query)\b/m.test(readFileSync(f, 'utf8'))) decoratorFound = true;
  }
  check('生成物全部通过语法检查', syntaxOk);
  check('生成物无装饰器语法', !decoratorFound);

  // importmap JSON 合法
  let mapOk = false;
  try { JSON.parse(readFileSync(join(dir, 'src/importmap.json'), 'utf8')); mapOk = true; } catch {}
  check('importmap.json 为合法 JSON', mapOk);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(fail === 0 ? '\nSMOKE OK' : `\nSMOKE FAILED（${fail}）`);
process.exit(fail === 0 ? 0 : 1);
