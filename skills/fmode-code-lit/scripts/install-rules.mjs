#!/usr/bin/env node
/**
 * install-rules.mjs —— 把 fmode-code-lit 的前端规则装入目标项目的 ./.claude/rules/。
 *
 * 用法：
 *   node install-rules.mjs [targetDir] [--force]
 *   node install-rules.mjs [targetDir] --from <rulesRepoDir>   # 指定规则仓根目录
 *
 * 规则来源优先级：--from > 技能同仓 ../../.claude/rules > 内置最小规则集。
 * 已存在文件默认不覆盖（--force 覆盖）。
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const target = resolve(args.find((a) => !a.startsWith('--') && a !== undefined && !a.startsWith('-')) || '.');
const force = args.includes('--force');
const fromIdx = args.indexOf('--from');
const fromDir = fromIdx > -1 ? resolve(args[fromIdx + 1]) : null;

// 规则来源候选
const candidates = [
  fromDir,
  resolve(__dirname, '../../../.claude/rules'), // 技能在 <repo>/skills/fmode-code-lit/scripts/
  resolve(__dirname, '../../.claude/rules'),
].filter(Boolean);
const srcRules = candidates.find((d) => d && existsSync(d) && existsSync(join(d, 'architecture.md')));

const destRules = join(target, '.claude', 'rules');
mkdirSync(destRules, { recursive: true });

let created = 0, skipped = 0;
function copyTree(from, to) {
  for (const name of readdirSync(from)) {
    const s = join(from, name), d = join(to, name);
    const st = statSync(s);
    if (st.isDirectory()) { mkdirSync(d, { recursive: true }); copyTree(s, d); continue; }
    if (!name.endsWith('.md')) continue;
    if (existsSync(d) && !force) { skipped++; console.log(`  skip  ${d}`); continue; }
    copyFileSync(s, d); created++; console.log(`  write ${d}`);
  }
}

if (srcRules) {
  console.log(`\n规则来源：${srcRules}`);
  copyTree(srcRules, destRules);
} else {
  console.log('\n未找到规则仓，写入内置最小规则集。');
  const minimal = {
    'lit-no-build.md': `# Lit 无构建前端 · 最小规则\n\n1. 源码即产物：不引入任何打包器。\n2. 依赖由 importmap 指向 FMODE Repose，禁止拷进项目。\n3. **禁用装饰器**（@customElement/@property/@state/@consume）——用 static properties + customElements.define + ContextConsumer。\n4. 分层：组件(渲染)→服务(业务/状态)→工具(纯函数)；组件禁 fetch，服务禁 DOM。\n5. 相对导入必须带 .js 后缀。\n6. 全局状态用 @lit-labs/signals；组件本地状态用 static properties(state:true)。\n7. 子目录部署必须 <base href=\"/<project>/\">，且与 OBS 前缀、importmap 前缀三者同源。\n8. 导航一律走 utils/router.js（把应用内路径拼到 base 的 pathname 上）；禁止 new URL(path, baseURI)，子路径部署会丢前缀。\n9. 子路径部署禁用 @lit-labs/router（全局 <a> 拦截 + 未剥前缀 pathname 会污染路由）。\n10. CDN History 回退：不存在路径 200 返回 index.html，禁 302。\n`,
  };
  for (const [name, content] of Object.entries(minimal)) {
    const d = join(destRules, name);
    if (existsSync(d) && !force) { skipped++; continue; }
    writeFileSync(d, content); created++; console.log(`  write ${d}`);
  }
}

// CLAUDE.md 片段（追加式，不覆盖已有正文）
const claudeMd = join(target, 'CLAUDE.md');
const snippet = `\n## 前端（Lit 原生 ESM 无构建）\n\n本项目前端遵循 \`.claude/rules/\` 下的 Lit 无构建规则：源码即产物、依赖走 importmap、\n分层（组件/服务/工具）、**禁用装饰器**、@lit-labs/signals 响应式、自写 utils/router.js History 路由（子路径部署禁用 @lit-labs/router）。\n详见 \`.claude/rules/architecture.md\` 与 \`.claude/rules/components.md\`。\n`;
if (existsSync(claudeMd)) {
  const cur = readFileSync(claudeMd, 'utf8');
  if (!cur.includes('Lit 原生 ESM 无构建')) { writeFileSync(claudeMd, cur + snippet); console.log(`  append ${claudeMd}`); }
  else console.log(`  skip  ${claudeMd}（已含片段）`);
} else {
  writeFileSync(claudeMd, `# 项目规则\n${snippet}`); created++; console.log(`  write ${claudeMd}`);
}

console.log(`\n✓ 完成：新建 ${created}，跳过 ${skipped}。规则目录：${destRules}\n`);
