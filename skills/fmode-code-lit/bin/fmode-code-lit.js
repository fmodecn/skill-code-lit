#!/usr/bin/env node
/**
 * fmode-code-lit CLI
 * 用法：
 *   npx fmode-code-lit install      # 装技能到 ~/.claude/skills/（默认）
 *   npx fmode-code-lit workspace    # 装技能到 ./.claude/skills/
 *   npx fmode-code-lit check        # 校验安装
 *   npx fmode-code-lit scaffold <dir> --project <name>   # 生成无构建 Lit 项目骨架
 *   npx fmode-code-lit new <component|service|page> <name>
 *   npx fmode-code-lit rules [dir]  # 把前端规则装入目标项目 ./.claude/rules/
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPTS = path.join(__dirname, '..', 'scripts');
const [cmd = 'install', ...rest] = process.argv.slice(2);

const MAP = {
  install: 'install.mjs',
  workspace: 'install.mjs',
  check: 'install.mjs',
  scaffold: 'scaffold.mjs',
  new: 'new.mjs',
  rules: 'install-rules.mjs',
};

const script = MAP[cmd];
if (!script) {
  console.error(`未知命令：${cmd}\n可用：${Object.keys(MAP).join(', ')}`);
  process.exit(2);
}
// workspace 需作为首参透传给 install.mjs（install.mjs 默认 install）
const argv = (cmd === 'workspace' || cmd === 'install' || cmd === 'check')
  ? [path.join(SCRIPTS, script), cmd, ...rest]
  : [path.join(SCRIPTS, script), ...rest];

const r = spawnSync(process.execPath, argv, { stdio: 'inherit' });
process.exit(r.status ?? 1);
