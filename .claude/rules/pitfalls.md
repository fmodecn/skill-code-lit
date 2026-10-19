# 风险与坑位

> 无构建方案的红线。踩中任何一条，症状往往隐蔽（白屏 / 404 / 路由丢失），
> 排查时先按本表逐条对照。

## 〇、用了装饰器语法（`@customElement` 等）

**症状**：整个模块 `SyntaxError: Invalid or unexpected token` / `Unexpected character '@'`，白屏。
**原因**：装饰器是 **TS/Babel 编译期**特性，浏览器原生 JS **不执行**。Lit 官方文档默认「装饰器 + 构建」，
无构建下照抄即挂。
**对策**：一律用 `static properties` + `customElements.define()` + `ContextConsumer` 编程式 API。
详见 [components.md](./components.md) 第〇节。**本项目所有示例均无装饰器**。

## 一、CORS（最高频）**症状**：模块加载失败、`Failed to fetch dynamically imported module`、控制台 CORS 报错。
**原因**：FMODE Repose 未放行业务域名。
**对策**：Repose 的 CORS 必须允许所有业务域名；跨域模块请求带 `Origin`，响应需 `Access-Control-Allow-Origin`。
> ESM 模块请求是 **CORS 请求**（比普通脚本严格），勿用「能下载就能跑」判断。

## 二、Content-Type 不是 `text/javascript`

**症状**：`Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of ...`。
**原因**：依赖仓把 `.js` 当 `text/plain` / `application/octet-stream` 返回。
**对策**：Repose 上传时显式设 `Content-Type: text/javascript; charset=utf-8`。

## 三、多版本 lit 混用

**症状**：自定义元素重复注册报错 `Failed to execute 'define' ... has already been used`；或响应式失效。
**原因**：importmap / 直接路径引到了两个不同版本的 lit（如 `lit@3.1` 与 `lit@3.2` 各被加载一次，`LitElement` 类不同）。
**对策**：**全业务统一 importmap**，只允许一个 lit 版本；所有包都从同一 Repose 版本段解析。除 `lit` 本身，注意 `lit-html` / `lit-element` / `@lit/reactive-element` 也要**单实例**（importmap 里补全子路径映射）。

## 四、History 路由被 CDN 302

**症状**：深链接刷新后地址栏变成 `/index.html`，路由参数丢失；微信 OAuth 回调失败。
**原因**：CDN 回退用 301/302 重定向。
**对策**：回退**必须 200** 返回 `index.html`，地址栏不变。见 [deployment.md](./deployment.md)。

## 四·一、`new URL(path, baseURI)` 丢部署前缀（子路径部署最高频）

**症状**：子路径部署下（`/dev/myapp/`）导航跳到域名根 `https://cdn/students`，刷新 404；
根部署时正常。
**原因**：`new URL` 的相对解析：`input` 以 `/` 开头时是绝对路径，会**整体替换** base 的
path，**不保留** base 的目录前缀。
**对策**：把应用内路径**拼到 base 的 pathname 上**再解析；导航一律走 `utils/router.js`。
见 [routing-best-practices.md 坑 1](./routing-best-practices.md#坑-1任意的-new-urlpath-baseuri-会丢掉部署前缀)。

## 四·二、`@lit-labs/router` 污染子路径部署的路由状态

**症状**：引入后路由偶发跳错/停错页/点内部链接整页刷新，根部署正常、二级路径异常。
**原因**：它装全局 `<a>` click 拦截器自行 `pushState`；且用**未剥前缀**的 `location.pathname`
匹配（路由表是应用内路径）。
**对策**：子路径部署**自写** `utils/router.js`（~60 行）；根部署可选。
见 [routing-best-practices.md 坑 2](./routing-best-practices.md#坑-2lit-labsrouter-在子路径部署下污染路由状态)。

## 五、子目录部署缺 `<base href>`（或三处前缀不一致）

**症状**：`./app.js`、相对 import 全部 404（被解析到域名根）。
**原因**：子目录部署（`/admin/`）未写 `<base href="/admin/">`；或 `<base href>`、
OBS 上传前缀、importmap 路径前缀**三处不一致**。
**对策**：三处由**同一变量派生**，部署脚本里 `grep` 硬校验；`navigate()` 基于 base 拼 URL。
见 [routing-best-practices.md 坑 4](./routing-best-practices.md#坑-4base-href-与实际部署前缀不一致三处必须同源)。

## 六、相对 import 漏写 `.js` 后缀

**症状**：`Failed to resolve module specifier './foo'` / 404。
**原因**：浏览器原生 ESM **不做扩展名补全**。
**对策**：相对导入一律带 `.js`（`import x from './foo.js'`）。裸标识符（`lit`）走 importmap。

## 七、Signal 与 Lit property 混用

**症状**：更新时机错乱、该刷不刷、或刷两次。
**原因**：把「组件本地 UI 状态」也塞进全局 signal，或把「跨组件业务状态」放在 `@property` 里手动同步。
**对策**：**划清界限** —— 组件内 UI 用 `@property`/`@state`；跨组件业务用 signal + `SignalWatcher`。

## 八、ESM 小文件多 → 请求多

**症状**：首屏依赖瀑布、加载慢。
**原因**：无打包 = 每个模块一次请求。
**对策**：Repose 开 **HTTP/2/3** 多路复用；合理目录深度（别过深）；`Cache-Control` 长缓存版本化依赖。

## 九、老浏览器不支持 Import Map

**症状**：低版本浏览器无法解析裸标识符。
**原因**：Import Map 是现代浏览器原生特性。
**对策**：内部后台一般可接受现代浏览器基线；如需兼容，引入 import-map polyfill（es-module-shims）放在所有 module 之前。

## 十、循环依赖导致初始化时机问题

**症状**：某模块拿到 `undefined`（如 `http` 顶层解构了尚未初始化的 `authService`）。
**原因**：ESM 循环引用 + 顶层立即求值。
**对策**：跨模块引用**延迟到函数内**取值（别在模块顶层解构相互引用的单例）。

## 十一、无构建下的其他红线

| 坑 | 说明 |
|----|------|
| 引入需要打包器转译的依赖（CJS/TS） | 浏览器无法直接跑 CJS；只选 **原生 ESM** 依赖 |
| 用 `.ts` 源码直发 OBS | 浏览器不认 TS；无构建下**源码即 JS** |
| 直接改 `src/` 后忘记刷 CDN | 看到旧版本；发布流程要含 CDN 刷新 |
| `index.html` 被 CDN 长缓存 | 回退/更新拿到旧壳；`index.html` 设 `no-cache` |
| `index.html` 被 `sync` 跳过 | `sync` 按 size+mtime 判 Skip；**先删后传** |
| CDN 刷新「看似成功」 | `refresh_task` 是字符串 ID，读 `.id` 恒 undefined → 假成功；须非空断言 + 失败退出非 0 |
| CDN 刷新只刷了一个域名 | domain_id/凭证对号入座；未知域名直接报错 |
| 只 `curl` 首页算验收 | 首页 200 ≠ 能跑；须模块图爬取 + 真实浏览器 |
| 自定义元素标签忘带连字符 | `define` 抛错，如 `approot` 应 `app-root` |
| 在卡片内嵌链接未 `stopPropagation` | 点内层链接触发外层跳转；内层 `@click` 断冒泡 |

> 路由 / base / CDN 的完整肺坑见 [routing-best-practices.md](./routing-best-practices.md)。

## 十二、排查口诀

1. 看控制台 **MIME / CORS / 404** 三类报错——先分清是「依赖没托管好」还是「业务路径错」。
2. 打开 Network：模块请求的 **Content-Type** 与 **状态码**。
3. 深链接刷新 404 → 查 CDN 回退规则（是否 200）。
4. 相对资源 404 → 查 `<base href>` 与部署前缀是否一致。
5. 导航跳到域名根 / 前缀丢失 → 查是否用了 `new URL(path, baseURI)`。
6. 点内部链接整页刷新 / 路由跳错 → 查是否引入 `@lit-labs/router`（子路径部署）或裸 `<a>`。
7. 线上还是旧版 → 查 CDN 刷新的 domain_id 与 `refresh_task` 返回值（别信「假成功」日志）。
8. 元素重复注册 → 查 lit 是否多版本。
