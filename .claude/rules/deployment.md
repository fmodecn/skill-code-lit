# 部署规范（FMODE Repose + OBS/CDN）

> 本仓为 **private**。本篇含内部部署细节，**禁止**复制到对外文档 / 开源材料 / 公开仓库。
> 无论对内对外，**AK/SK 密钥一律不写进任何文档或代码**，只从既有部署脚本引用。

## 一、两条托管线

| 内容 | 托管方 | 说明 |
|------|--------|------|
| **依赖**（lit / @lit-labs/*） | **FMODE Repose** | 静态依赖仓，从 npm 下**原始 ESM** 原样同步，按版本目录化，全业务共享 |
| **业务码**（index.html / js） | **OBS + CDN** | `obsutil` 同步 `src/` 到华为云 OBS，`public-read`，CDN 加速 |

## 二、FMODE Repose（静态依赖仓）

**存放布局**

```
/npm/lit/v3.x.x/                      # lit 运行时（原始 ESM）
/npm/@lit-labs/context/vx/            # context
/npm/@lit-labs/signals/vx/            # signals
/npm/@lit-labs/router/vx/             # router
/npm/importmap/lit-v3.json            # 公共 importmap（全业务复用）
```

**硬性要求**

1. `.js` 响应的 `Content-Type` **必须** `text/javascript`（否则浏览器拒绝作为模块执行）。
2. **CORS 允许业务域名**（否则跨域模块加载失败）。
3. 开启 **HTTP/2（或 /3）** —— ESM 小文件多，靠多路复用降延迟。
4. 依赖按**版本目录**化（`/vX.Y.Z/`），升级 = 新增目录 + 改 importmap 版本号，**不覆盖旧版本**。
5. 保持 npm 包的**相对 import 结构**原样（原样同步，不重写 import）。

**同步方式**：把 `node_modules/lit`、`node_modules/@lit-labs/*` 原样上传到 Repose 对应版本目录。
（仓库内提供同步脚本入口占位，实际凭据从环境 / 既有脚本注入。）

**公共 importmap**（托管在 Repose，业务引用）

```json
{
  "imports": {
    "lit": "/npm/lit/v3.2.1/lit.js",
    "lit/": "/npm/lit/v3.2.1/",
    "lit/decorators.js": "/npm/lit/v3.2.1/decorators.js",
    "@lit-labs/signals": "/npm/@lit-labs/signals/v0.1.3/index.js",
    "@lit-labs/context": "/npm/@lit-labs/context/v0.5.1/index.js",
    "@lit-labs/router": "/npm/@lit-labs/router/v0.2.0/router.js"
  }
}
```

> 版本号以仓库实际落地为准，此处为示例形态。升级依赖 = 追加新路径 + 改这里的版本段。

## 三、OBS + CDN（业务部署）

**入口 index.html**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <base href="/<project>/" /><!-- 二级路径部署必须；根部署可省略或 "/" -->
  <link rel="importmap" href="..."><!-- 见下 -->
  <script type="importmap" src="<公共 importmap URL>"></script>
</head>
<body>
  <app-root></app-root>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

- 公共 importmap 由 **Repose 托管**，全业务用同一份：
  `<script type="importmap" src="<Repose>/npm/importmap/lit-v3.json"></script>`。
- `<base href>` 决定相对路径基准，子目录部署**必须**写对。

**上传（obsutil）**

- 工具：`/opt/data/bin/obsutil`
- 桶（bucket）与端点、AK/SK：**从既有部署脚本引用**（如 `fmode-app/scripts/deploy.sh`），**禁止**写入本仓文档/代码。
- 典型命令形态：

```bash
# 同步业务源码到 OBS 前缀，公开读
obsutil sync ./src/ obs://<bucket>/<project>/ \
  -e=obs.cn-south-1.myhuaweicloud.com -acl=public-read -f
```

- **index.html 先删后传**：`sync` 按 size+mtime 判 Skip，`index.html` 名字固定、内容随发布变化，需先 `rm` 再 `cp`，避免被 Skip。
- 静态资源设 `Cache-Control`：`index.html` 用 `no-cache`（保证回退拿到最新），带 hash 的资源可长缓存。

**CDN 刷新**：上传后调用 CDN refresh（仓库内 `scripts/deploy.sh` 已接入既有刷新脚本）。刷新**范围**由传入的 URL 域名决定。

> ⚠️ **CDN 刷新的两个假成功陷阱**（实测踩过，详见
> [routing-best-practices.md 坑 5](./routing-best-practices.md#坑-5cdn-刷新看似成功实则没刷)）：
> 1. **域名对号入座**：每个加速域有各自的 `domain_id` 与凭证；用错只刷了一个域名，
>    用户访问的另一个域名照旧是旧内容。未知域名应**直接报错**，别静默跳过。
> 2. **SDK 返回结构**：`refresh_task` 是**字符串 ID**，不是对象。若读成
>    `result.refresh_task.id` 会恒得 `undefined`，脚本**照常退出 0**（假成功）。
>    必须对结果做**非空断言**，任一失败则**退出码非 0**。
>
> 刷新用 `type: 'directory'`（URL 以 `/` 结尾）一次覆盖目录，比逐个 file 省事且不易漏。

## 三·五、验收：不能只 `curl` 首页

`curl` 首页 200 **只证明 `index.html` 在**；无构建应用白屏的典型原因（某模块 404、MIME 错、
回退没配、相对路径错一个字符）它一个都不覆盖。分层验收：

1. **静态体检**（部署前）：`node --check` 无语法/装饰器残留；相对 import 带 `.js`；
   相对目标存在；裸标识符都在 importmap；自定义元素标签含连字符。
2. **模块图爬取**（部署后，HTTP 层）：从入口 `app.js` 跟随相对 import 走完整图，
   断言每个文件 **200 + `Content-Type: text/javascript`**；importmap 每条目标可达；
   **深链接返回 200 且内容是 `index.html`**（非 302）。
3. **真实浏览器**（最终验收）：点导航 + 刷新深链接，确认不 404、无控制台报错。
4. **缓存层**：核对 CDN 返回的**内容**是新版（不只是状态码）。

> 把 1–2 步固化成一条命令纳入部署流程。可复用脚本形态见
> [routing-best-practices.md 坑 7](./routing-best-practices.md#坑-7只-curl-首页不算验收)。

> 🔎 **CDN 冷边缘**：新上传的 key 首次被某边缘节点拉取时**偶发 404**（回源竞争），
> 重跑一次即消失 —— 验收脚本碰到新 key 的首次 404 不要立刻判故障。

## 四、History 路由的 CDN 回退（关键）

| 规则 | 匹配 | 动作 |
|------|------|------|
| 规则 1 | 命中真实静态资源 | 直接返回该文件 |
| 规则 2 | 路径不存在 | 返回 `index.html`，状态码 **200**，**禁止 301/302** |

- 用 **200** 而非 302：302 会改写地址栏 / 丢 `location.pathname`，破坏路由参数与微信 OAuth 回调。
- `index.html` 设 `no-cache`，确保回退总是拿到最新壳。

## 五、部署脚本（模板）

```bash
#!/usr/bin/env bash
# scripts/deploy.sh —— 无构建，直接同步 src/ 到 OBS，再刷 CDN
set -euo pipefail
PROJECT="${1:?usage: deploy.sh <project>}"
BUCKET="${OBS_BUCKET:?set OBS_BUCKET}"           # 例: obs://www-fmode.cn
PREFIX="$PROJECT"
EP="obs.cn-south-1.myhuaweicloud.com"
OBS=/opt/data/bin/obsutil

# 1) index.html 先删后传（防 Skip）+ no-cache
"$OBS" rm "$BUCKET/$PREFIX/index.html" -e="$EP" -f >/dev/null 2>&1 || true
"$OBS" cp ./src/index.html "$BUCKET/$PREFIX/index.html" -e="$EP" -acl=public-read -f \
  -meta="Cache-Control:no-cache#Content-Type:text/html; charset=utf-8"

# 2) 其余源码同步
"$OBS" sync ./src/ "$BUCKET/$PREFIX/" -e="$EP" -acl=public-read -f

# 3) 刷新 CDN（调用既有刷新脚本，凭据由该脚本/环境提供）
# node <既有刷新脚本> "https://<cdn-domain>/$PREFIX/"
```

- **凭据注入**：AK/SK 从环境变量 / 既有脚本读取，**不落本仓**。
- 无构建 → 无需构建步骤，`src/` 即产物。

## 六、发布 checklist

- [ ] `<base href>` 与部署前缀一致（**同一变量派生**，脚本里硬校验）
- [ ] importmap 指向 Repose（**内联**在 index.html），版本号/前缀正确
- [ ] 依赖已同步到 Repose（`Content-Type: text/javascript` + CORS 放行）
- [ ] OBS 上传完成，`index.html` 已先删后传 + `no-cache`
- [ ] CDN 回退规则：不存在路径 200 返回 index.html，**禁 301/302**
- [ ] CDN 刷新完成（`type:directory`，**domain_id 对号入座**，读 `refresh_task` 字符串，失败退出非 0）
- [ ] 直接命中深链接（如 `/users/42`）**刷新**可用（200 且为 index.html）
- [ ] 静态体检 + 模块图爬取通过；**真实浏览器**点导航/刷新深链接无报错

> 路由 / base / CDN 的完整肺坑与 check 清单见
> [routing-best-practices.md](./routing-best-practices.md)。
