# 路由最佳实践与常见坑（子路径部署 / History 模式 / CDN 回退）

> 本篇是 [routing.md](./routing.md) 的**实战补充**：routing.md 讲「怎么做」，本篇讲
> 「为什么这么做、错了会怎样、如何一眼定位」。
>
> 素材来自一次真实的多页看板交付（Lit 无构建、部署在 `/<env>/<project>/` 二级路径、
> History 干净 URL、走 OBS + CDN）。所有条目都对应一次真实故障。
>
> 通篇只讲**网页应用**的通用规律（路由 / base / CDN / 部署 / 验收），不含任何具体业务。

## 阅读方式

每条按 **症状 → 根因 → 最佳实践 / 规避** 组织。排查时按症状检索即可。

- 前缀缺失、深链接刷新 404：见 [坑 1](#坑-1任意的-new-urlpath-baseuri-会丢掉部署前缀)
- 路由状态被第三方库污染：见 [坑 2](#坑-2lit-labsrouter-在子路径部署下污染路由状态)
- 发版后看到旧页面：见 [坑 5](#坑-5cdn-刷新看似成功实则没刷)
- 部署脚本「跑完了但东西没上去/地址不对」：见 [坑 8](#坑-8部署脚本的-static-cd-陷阱与硬编码-url)

---

## 零、一张图记住全部关系

```
浏览器地址栏  https://<cdn>/<env>/<project>/students/s01
                         └────────┬─────────┘
                    部署前缀（必须三处一致）
                    = OBS 上传前缀
                    = <base href>
                    = importmap 里业务/依赖的路径前缀

index.html   <base href="/<env>/<project>/">     ← 相对 import 的解析基准
utils/router 把「应用内路径 /students/s01」拼到 base 的 pathname 上 → 真实 URL
CDN 回退      命中不了静态资源 → 200 返回 index.html（禁 302）
```

**一句话：应用内部只认「不含前缀的应用内路径」（`/students/s01`），
前缀只在三处出现一次（base href / 上传前缀 / importmap），且三者必须由同一个变量派生。**

---

## 坑 1：任意的 `new URL(path, baseURI)` 会丢掉部署前缀

**症状**
- 子路径部署（如 `/dev/myapp/`）下，点导航跳到 `https://<cdn>/students`（**域名根**，前缀没了）。
- 刷新该页 → **404**（OBS 上根目录没有这个文件，CDN 回退也没覆盖到）。
- 本地开发用根路径部署时一切正常，一上线换二级路径就崩 —— 典型的「环境相关」假象。

**根因**

`new URL(input, base)` 的语义是 **RFC 3986 相对解析**：当 `input` **以 `/` 开头**时，
它是**绝对路径**，会**整体替换** base 的 path，**不保留 base 的目录前缀**。

```js
new URL('/students', 'https://cdn/dev/myapp/')
// → https://cdn/students        ❌ 前缀 /dev/myapp 被丢掉
new URL('students', 'https://cdn/dev/myapp/')
// → https://cdn/dev/myapp/students  ✅ 但依赖 base 以 / 结尾，脆弱
```

而应用内部路径（`/students`）天然带前导 `/`，于是「尊重 `<base href>`」这个直觉写法
在子路径部署下**必然**丢前缀。

**最佳实践**

先把应用内路径**拼到 base 的 pathname 上**，再交给 URL 解析（此时相对解析不会丢前缀）：

```js
/** base 路径（去尾斜杠），如 '/dev/myapp'；根部署时为 '' */
export function basePath() {
  return new URL(document.baseURI).pathname.replace(/\/+$/, '');
}

/** 应用内路径 → 保留部署前缀的绝对 URL（查询串 / hash 原样保留） */
export function resolveUrl(path) {
  const base = basePath();
  const q = path.indexOf('?');
  const h = path.indexOf('#');
  let cut = path.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  let p = path.slice(0, cut);
  const rest = path.slice(cut);          // ?query#hash 原样带过去
  if (!p.startsWith('/')) p = '/' + p;   // 容错：允许传 'students'
  return new URL(base + p + rest, location.origin);
}
```

**红线（写进 code review 清单）**：业务代码里**禁止**出现 `new URL(path, document.baseURI)`
用在「导航 / 内部链接」上。一切经 `utils/router.js` 的 `resolveUrl()`。

---

## 坑 2：`@lit-labs/router` 在子路径部署下污染路由状态

**症状**
- 引入 `@lit-labs/router` 后，子路径部署的应用里路由「偶尔跳错 / 停在错误页 / 点内部链接整页刷新」。
- 根部署时完全正常，换二级路径后诡异。

**根因（两点叠加）**

1. 它在 `window` 上装了**全局 click 拦截器**，对**同源 `<a>` 自行 `pushState`** ——
   绕过你自己的导航函数（也就绕过了 base 前缀处理），且与「手动 `<a>` + 原生刷新」的行为预期冲突。
2. 它在 `hostConnected` / `popstate` 时，用**未经剥离的 `location.pathname`**（带着 `/dev/myapp/`）
   去匹配路由表 —— 而路由表里的 path 是**应用内路径**（`/students`），于是匹配不上 / 匹配错。

**最佳实践**

- **子路径部署的项目，不要用 `@lit-labs/router`**。自写一个 ~60 行的 `utils/router.js`：
  - `navigate(path, {replace})`：`pushState` 后**手动派发 `popstate`**（History 原生不触发），
    让订阅者感知；内部走 `resolveUrl()`（保留前缀）。
  - `currentPath()`：从 `location.pathname` **剥掉 base 前缀**，返回应用内路径。
  - `href(path)`：给**真实 `<a>`** 用，返回保留前缀的完整 URL。
- 要不要界面路由框架？**不需要**。无构建项目里「路由表 + `currentPath()` + `popstate` 订阅」
  就是最小的、可调试的路由。见 [routing.md 第二节](./routing.md)。
- 若坚持用第三方 router：必须在 `goto()`/`popstate` 前把 `pathname` 剥前缀，并
  关掉/绕过它的全局 `<a>` 拦截 —— 成本通常高于自写。

**配套：`currentPath()` 要稳**

```js
export function currentPath() {
  const base = basePath();
  const p = location.pathname;
  let path = p.startsWith(base) ? p.slice(base.length) : p;  // 脏 URL 退回全路径
  if (!path.startsWith('/')) path = '/' + path;
  return path.replace(/\/{2,}/g, '/') || '/';   // 折叠 '//students'
}
```

- **剥前缀**：路由表只认应用内路径。
- **脏数据兜底**：万一 URL 落在前缀之外（历史书签 / 手工输入），**退回到 `/` 开头的全路径**，
  交给路由表落到 404 页 —— 别抛异常、别白屏。
- **折叠重复斜杠**：`/dev/myapp//students` 不该变成两条不同路由。

---

## 坑 3：深链接刷新 404 —— CDN 回退不是 200

**症状**
- 站内点击正常（SPA 前端接管），但**在该 URL 上直接刷新 / 粘贴给别人打开 → 404**。
- 或：刷新后**地址栏变成了 `/index.html`**，路由参数全丢（这是 302 的特征）。
- 微信 OAuth 回调失败（`redirect_uri` 与实际落地 URL 不一致）。

**根因**

History 模式下，`/dev/myapp/students/s01` 这个路径在 OBS 上**根本不存在**（OBS 里只有
`index.html` 和真实文件）。没有回退规则时，CDN 直接 404。

**最佳实践**

CDN 配置**两条回退规则**，顺序不能反：

| 顺序 | 匹配 | 动作 |
|------|------|------|
| 规则 1 | 命中真实静态资源（`.js` / `.css` / `.png` …） | 直接返回该文件 |
| 规则 2 | 其余（路径不存在） | 返回 `index.html`，**状态码 200** |

- **必须 200，禁止 301/302**：302 会由浏览器改写地址栏、丢失 `location.pathname`，
  路由参数与 OAuth 回调全部破坏。回退「返回内容」而非「重定向」。
- `index.html` 设 `Cache-Control: no-cache`，保证回退永远拿到最新壳。
- 部署后**逐条实测深链接**（含一个不存在的路径，验证它会落到 404 页而不是报错）。
  见 [坑 7 验收清单](#坑-7只-curl-首页不算验收)。

---

## 坑 4：`<base href>` 与实际部署前缀不一致（三处必须同源）

**症状**
- 所有相对 import / 相对资源（`./app.js`、`./components/x.js`）**全部 404**，
  被解析到**域名根**而不是项目目录。
- 或换个环境部署后，importmap 指向的依赖路径 404。

**根因**

`<base href>`、OBS 上传前缀、importmap 里的路径前缀，是**同一个前缀的三个副本**。
只要有一处不一致（比如手工改了其中一处），就从那一处开始 404。

**最佳实践**

1. **三处同源**：在部署脚本里用**一个变量**派生全部前缀，禁止三处各写各的：

   ```bash
   OBS_PREFIX="dev/${PROJECT}"       # OBS 上传前缀
   BASE_HREF="/dev/${PROJECT}/"      # <base href> 期望值
   # importmap 里的业务/依赖路径 = /${OBS_PREFIX}/...
   ```

2. **部署脚本里硬校验**（失败即中止，别等到线上白屏）：

   ```bash
   grep -q "<base href=\"${BASE_HREF}\"" src/index.html \
     && echo "ok base href = ${BASE_HREF}" \
     || { echo "!! base href 与部署前缀 ${BASE_HREF} 不一致，相对 import 会 404" >&2; exit 1; }
   ```

3. **importmap 用内联**（`<script type="importmap">{...}</script>`），不要用
   `<script type="importmap" src="...">` 外链 —— 外链 importmap 浏览器支持面窄，
   内联是唯一 100% 可靠的形式。内联的那份同时托管一份到依赖仓供他项目复用。
4. **依赖也带前缀**：若依赖与业务同源（如都在 `/<env>/npm/`），importmap 里依赖路径
   **必须**写成 `/<env>/npm/lit/vX/index.js`，与 `<base href>` 前缀一致；
   同源即无 CORS 问题，是省事之选。

> 判定口诀：**根部署（`/`）时它无所谓，子路径部署时它是所有 404 的总开关。**

---

## 坑 5：CDN 刷新「看似成功实则没刷」

**症状**
- 发布后线上仍是**旧页面**（甚至新旧混着：壳是新的、某个 js 是旧的）。
- 刷新脚本日志打印 `taskId: undefined` 或干脆只刷了一个域名 —— 但**退出码为 0**，流水线绿灯。

**根因（两类，都要防）**

1. **域名/凭证错配**：脚本用的 domain_id（或 AK）只对某个加速域有效，
   只刷了 `a.example.com`，没刷 `app.example.com` —— 而用户访问的是后者。
2. **SDK 返回结构读错**：脚本读 `result.refresh_task.id`，而 SDK 实际返回的
   `refresh_task` 是**字符串 ID**（不是对象）→ 恒得 `undefined` → 打印
   `taskId: undefined` 后**照样退出 0**，形成**假成功**。

**最佳实践**

- 刷新 **`type: 'directory'`**（URL 以 `/` 结尾），一次覆盖目录下新增/变更文件，
  比逐个 file 刷新省事、不易漏。
- **按域名对号入座**：维护 `host → domain_id` 映射表，URL 里解析出 host 再取对应
  domain_id + 凭证；**未知域名直接报错退出**，绝不静默跳过。
- **把假成功变成真失败**：对刷新结果**做非空断言**，任一失败则**退出码非 0**：

  ```js
  const taskId = r.refresh_task;              // ← 字符串 ID，不是 r.refresh_task.id
  if (!taskId) { failed++; continue; }        // 没有 taskId = 没提交成功，不得算成功
  ...
  process.exit(failed ? 1 : 0);
  ```

- 部署脚本调用刷新失败时**不要吞掉**（最多提示可手动重试，但要让流水线红）。

---

## 坑 6：`index.html` 被 `sync` 跳过 / 被长缓存

**症状**
- 发了新版，`index.html` 还是旧的（但新增的文件都在）—— 典型的「壳没更新」。
- 或者 CDN 回退拿到的 `index.html` 是缓存里的旧壳。

**根因**

- `obsutil sync` 按 **size + mtime** 判定 Skip。`index.html` 名字固定、内容随发布变化，
  若 size 恰好相同（或 mtime 未变），**会被静默跳过**。
- CDN 若把 `index.html` 也长缓存，回退/更新都拿到旧壳。

**最佳实践**

- **先删后传**：`obsutil rm <prefix>/index.html` 再 `obsutil cp ./src/index.html ...`，
  并排除它不参与上一步的 `sync`（`-exclude="index.html"`）。
- 传 `index.html` 时显式设头：
  `-meta="Cache-Control:no-cache, no-store, must-revalidate#Content-Type:text/html; charset=utf-8"`。
- 带内容 hash 的静态资源可长缓存；`index.html` 永远 `no-cache`。
- ⚠️ **CDN 冷边缘**：新上传的 key 首次被某边缘节点拉取时**偶发 404**（回源竞争），
  **重跑一次即消失**。验收脚本遇到新 key 的首次 404 不要立刻判定为故障。

---

## 坑 7：只 `curl` 首页不算验收

**症状**
- 部署脚本 `curl -w '%{http_code}'` 首页 → 200 → 认为发布成功。
- 用户打开 → **白屏**（某个模块 404 / MIME 错 / 回退没配 / 某个相对路径错一个字符）。

**根因**

`curl` 首页 200 只能证明 `index.html` 在。浏览器加载一个无构建 ESM 应用会走一条**长链路**，
任一环断裂都白屏，而 `curl` 一个都不覆盖：

```
index.html → 内联 importmap → 解析裸标识符 → 拉模块（MIME 必须 text/javascript）
           → 模块内相对 import（必须带 .js）→ 再拉… → 深链接回退（必须 200）
```

**最佳实践（分层验收，越往下越真）**

1. **静态体检**（部署前，`node --check` + 解析）：语法/装饰器残留、相对 import 带 `.js`、
   相对目标存在、裸标识符都在 importmap、自定义元素标签含连字符。
2. **模块图爬取**（部署后，HTTP 层）：从入口 `app.js` 出发**跟随相对 import 走完整图**，
   断言每个文件 **200 + MIME 为 `text/javascript`**；再断言 importmap 每条目标可达；
   再断言**深链接返回 200 且内容是 index.html**（`num_redirects=0`）。
   —— 这一步比人眼快，且能在 CI 里跑。
3. **真实浏览器**（最终验收）：用 Playwright/真实浏览器**点导航 + 刷新深链接**，
   确认不 404、无控制台报错。HTTP 层过了不代表渲染没问题（渲染报错、Signal 时机等）。
4. **缓存层**：核对 CDN 实际返回的**内容**（不只是状态码），确认是新版。

> 原则：**能自动断言的都断言，别靠「我 curl 了一下 200」。**
> 一个可复用的验收脚本应把上面 1–2 步固化成一条命令，纳入部署流程。

---

## 坑 8：部署脚本的 static cd 陷阱与硬编码 URL

**症状**
- 脚本在某个目录下「卡住」或后续命令全部相对错位。
- 文档里的交付链接**换一个项目 / 换一个篇目就 404**（把上一篇的 URL 抄到了新篇）。

**根因**

- **`cd` 相对路径**：脚本用相对路径 `cd`，或在管道/子 shell 里改了 cwd，
  后续 `obsutil` / 文件路径全部相对错位。
- **硬编码 URL**：把「某一次的线上地址」写死进文档/配置；换项目后就指向不存在的资源。

**最佳实践**

- 脚本开头用**以脚本自身位置推导的绝对路径**，不依赖调用者的 cwd：

  ```bash
  set -euo pipefail
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$REPO_ROOT"
  ```

- **参数化**：域名 / 前缀 / 桶都从**变量或参数**取（`PROJECT`、`OBS_PREFIX`、`BASE_HREF`），
  绝不散落字面量；URL 用这些变量拼出来。
- **交付物链接**用统一的 URL 构造函数生成（`https://<cdn>/<prefix>/<path>`），
  不要人肉抄。文档里若必须贴链接，**注明它是哪个项目/前缀**，避免跨项目误用。
- 顺手加 `--dry` 只打印不执行的开关，方便核对将要跑的命令。

---

## 坑 9：裸 `<a href>` 与 SPA 导航冲突；`href()` 要留出「新标签打开」

**症状**
- 点内部链接**整页刷新**：多标签 KeepAlive 全丢、状态重置、白屏一瞬。
- 或：为了 SPA 全部改用 `navigate()`，结果**中键/右键「在新标签打开」失效**。

**根因**

- 原生 `<a href="/x">` 触发**整页导航**，不是 SPA 行为。
- 但**全部**改成 JS click 又牺牲了浏览器原生能力（新标签、复制链接、无障碍）。

**最佳实践**

两套出口，按需选：

| 场景 | 用什么 | 说明 |
|------|--------|------|
| 站内跳转（按钮/菜单项，语义是「切页面」） | `navigate(path)` | `pushState` + 派发 `popstate`，SPA 不刷新 |
| 真链接（要给用户「新标签打开/复制链接」） | `<a href=${href(path)}>` | `href()` 返回**保留前缀**的完整 URL，中间键/右键正常 |
| 在卡片/行内点击的**链接**（防止触发外层跳转） | `@click=${e => e.stopPropagation()}` | 见 [坑 10](#坑-10可点击交付链接点它不该触发外层卡片跳转) |

- 内部导航**一律**经 `utils/router.js`，**禁止**裸 `new URL(path, baseURI)`（见坑 1）
  与第三方全局拦截（见坑 2）。
- 菜单项若用 `<div>` 模拟链接，记得补 `role="link" tabindex="0"` 与
  `@keydown` 回车触发，保持键盘可达。

---

## 坑 10：可点击交付链接，点它不该触发外层卡片跳转

**症状**
- 卡片整体可点（进详情），卡片里还嵌了「打开报告 / 打开仓库」链接 ——
  点内层链接时**外层跳转也触发了**，或整页被导航走、新标签没打开。

**根因**

事件冒泡：内层 `<a>` 的 `click` 冒泡到外层卡片的 `click` 处理器。

**最佳实践**

- 内层链接 `@click=${(e) => e.stopPropagation()}`，切断冒泡；用**真实 `<a>` + `target="_blank"`**
  让浏览器开新标签，别用 `window.open` 绕。
- 交给数据的链接用**统一结构**（如 `{kind, label, url}` 数组），渲染层据 `kind` 决定
  图标/文案，便于一致地展示「报告 / 看板 / 文档 / 仓库」等多种入口。
- **进度/状态展示**这类看板常见模式：
  - **不要编造数据**：字段缺失就**留空**（如还没有的真实 URL 一律空），
    比填假的强 —— 空会被发现，假的会被当成事实。
  - 筛选层统一剔除**不该计入统计的条目**（内部人员/测试数据），
    在服务层做，不要在展示层各自打补丁。
  - 进度口径**写清楚**（「以输出报告为最终节点」这类），口径变了要在 UI/文档同步标注，
    避免同一数字两种理解。

---

## 附：内部导航工具（可直接复制的最小实现）

```js
// utils/router.js —— 子路径部署安全的导航（只用 History API，干净 URL）
export function basePath() {
  return new URL(document.baseURI).pathname.replace(/\/+$/, '');
}

export function resolveUrl(path) {
  const base = basePath();
  const q = path.indexOf('?'), h = path.indexOf('#');
  let cut = path.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  let p = path.slice(0, cut);
  const rest = path.slice(cut);
  if (!p.startsWith('/')) p = '/' + p;
  return new URL(base + p + rest, location.origin);
}

export function navigate(path, { replace = false } = {}) {
  const url = resolveUrl(path);
  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));  // History 原生不触发
}

export function currentPath() {
  const base = basePath();
  let path = location.pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length);
  if (!path.startsWith('/')) path = '/' + path;
  return path.replace(/\/{2,}/g, '/') || '/';
}

export function currentQuery() {
  return Object.fromEntries(new URLSearchParams(location.search));
}

export function href(path) { return resolveUrl(path); }   // 供真实 <a href>
```

路由表 + 订阅（`app-shell` 里）：监听 `popstate`，用 `currentPath()` 匹配路由表，
命中则「打开/激活」对应视图（多标签场景下不要整体重渲染，见
[tabs-keepalive.md](./tabs-keepalive.md)）。

---

## 附：上线前 checklist（路由 / base / CDN 维度）

- [ ] `<base href>` == OBS 上传前缀 == importmap 路径前缀（**同一变量派生**，脚本里有硬校验）
- [ ] importmap **内联**在 `index.html`，依赖路径带正确的部署前缀
- [ ] 业务代码**无** `new URL(path, baseURI)` 用于导航；无 `@lit-labs/router`（子路径部署）
- [ ] `currentPath()` 剥前缀 + 脏 URL 兜底 + 折叠 `//`
- [ ] CDN 回退：命中真实资源直返；不存在路径 **200** 返回 `index.html`，**禁 301/302**
- [ ] `index.html` 先删后传 + `no-cache`
- [ ] CDN 刷新：`type:directory`，**对号入座 domain_id**，读 `refresh_task`（字符串），失败退出非 0
- [ ] 静态体检（语法/装饰器/`.js` 后缀/importmap 覆盖/标签连字符）通过
- [ ] 模块图爬取（200 + `text/javascript`）通过
- [ ] 深链接**刷新** 200 且为 `index.html`（含一个不存在的路径 → 落 404 页）
- [ ] **真实浏览器**点导航 + 刷新深链接，无 404、无控制台报错
- [ ] 交付链接 `target=_blank` 可点、不触发外层跳转；无数据不编造，留空

---

## 相关

- [routing.md](./routing.md) —— 路由基本用法（History、守卫、OAuth、多标签交互）
- [deployment.md](./deployment.md) —— Repose 依赖托管 + OBS/CDN 部署 + 回退规则
- [pitfalls.md](./pitfalls.md) —— 无构建的通用坑（装饰器 / CORS / MIME / 多版本 lit）
- [tabs-keepalive.md](./tabs-keepalive.md) —— 多标签 KeepAlive 与路由的配合
- [project-structure.md](./project-structure.md) —— 子路径部署与 `<base href>`
