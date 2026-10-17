#!/usr/bin/env bash
# examples/hello-lit/deploy.sh —— 无构建部署：同步 src/ 到 OBS + CDN 刷新
#
# 凭据不写死在仓库：AK/SK 由既有部署脚本 / 环境变量提供。
# 本脚本仅演示命令形态，实际发布请复用项目既有 deploy 脚本。
set -euo pipefail

PROJECT="${1:-hello-lit}"
BUCKET="${OBS_BUCKET:?需设置 OBS_BUCKET，例如 obs://www-fmode.cn}"
EP="${OBS_ENDPOINT:-obs.cn-south-1.myhuaweicloud.com}"
OBS="${OBSUTIL:-/opt/data/bin/obsutil}"
SRC="$(cd "$(dirname "$0")" && pwd)/src"

echo "==> 同步 $SRC -> $BUCKET/$PROJECT/"

# 1) index.html 先删后传（sync 按 size+mtime 判 Skip，index.html 内容常变）
"$OBS" rm "$BUCKET/$PROJECT/index.html" -e="$EP" -f >/dev/null 2>&1 || true
"$OBS" cp "$SRC/index.html" "$BUCKET/$PROJECT/index.html" \
  -e="$EP" -acl=public-read -f \
  -meta="Cache-Control:no-cache#Content-Type:text/html; charset=utf-8"

# 2) 其余源码同步（无构建：src/ 即产物）
"$OBS" sync "$SRC/" "$BUCKET/$PROJECT/" -e="$EP" -acl=public-read -f

echo "==> 刷新 CDN（调用既有刷新脚本，凭据由该脚本/环境提供）"
# node <既有刷新脚本> "https://<cdn-domain>/$PROJECT/"
echo "完成。请确认 CDN 回退规则：不存在路径 200 返回 index.html（禁 302）。"
