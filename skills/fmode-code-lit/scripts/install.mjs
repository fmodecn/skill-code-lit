#!/usr/bin/env node
/**
 * install.mjs —— 把 fmode-code-lit 技能安装到 Claude Code 技能目录。
 *
 * 用法：
 *   node install.mjs install     # → ~/.claude/skills/fmode-code-lit/（全局，默认）
 *   node install.mjs workspace   # → ./.claude/skills/fmode-code-lit/（当前项目）
 *   node install.mjs install --target <dir> [--force]
 *   node install.mjs check       # 校验安装
 */
import { mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_SRC = resolve(__dirname, '..');           // <...>/skills/fmode-code-lit
const SKILL_NAME = 'fmode-code-lit';

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('--') ? args[0] : 'install';
const force = args.includes('--force');
const tIdx = args.indexOf('--target');
const globalTarget = join(homedir(), '.claude', 'skills', SKILL_NAME);
const workspaceTarget = join(process.cwd(), '.claude', 'skills', SKILL_NAME);

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name === 'node_modules') continue;
    const s = join(from, name), d = join(to, name);
    if (statSync(s).isDirectory()) copyTree(s, d);
    else if (!existsSync(d) || force) copyFileSync(s, d);
  }
}

function verify(target) {
  const must = ['SKILL.md'];
  const missing = must.filter((f) => !existsSync(join(target, f)));
  if (missing.length) { console.error(`✗ 安装不完整，缺少：${missing.join(', ')}`); process.exit(1); }
  console.log(`✓ 技能已就位：${target}`);
  console.log(`  SKILL.md 存在，scripts/ ${existsSync(join(target, 'scripts')) ? '存在' : '缺失'}`);
}

function main() {
  const target = cmd === 'workspace' || cmd === 'install-workspace'
    ? workspaceTarget
    : (tIdx > -1 ? resolve(args[tIdx + 1]) : globalTarget);
  if (cmd === 'check') { verify(target); return; }
  if (!existsSync(SKILL_SRC)) { console.error(`✗ 找不到技能源：${SKILL_SRC}`); process.exit(1); }
  console.log(`安装 ${SKILL_NAME} → ${target}${force ? '（--force 覆盖）' : ''}`);
  copyTree(SKILL_SRC, target);
  verify(target);
  console.log(`\n触发词：lit 项目 / lit 组件 / 无构建前端 / WebComponent / importmap`);
}

main();
