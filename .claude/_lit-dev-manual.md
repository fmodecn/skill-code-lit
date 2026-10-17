# Lit 原生 ESM 无构建开发最佳实践（源稿）

> 用户提供规范文档全文。用于构建 fmode-code-lit 规则仓库。目标：零编译、零打包、纯原生 JS，基于浏览器原生 ESM + Import Map，复用 npm 原始包托管在内部 FMODE Repose，业务代码直接上传 OBS+CDN，保存刷新即预览。对标新版 Angular（History 干净路由、DI 依赖注入、Signal 细粒度响应式、组件/服务分层、后台多标签，无 Zone.js）。技术底座：原生浏览器 API（Fetch/History/localStorage）+ Lit 官方原生包。

## 一、整体架构
- **无构建无打包**：不用 rollup/esbuild/vite/webpack，源码浏览器直接执行
- **依赖统一托管**：lit、@lit-labs/* 从 npm 下原始 ESM 原样同步到内部 FMODE Repose，全业务共享
- **业务资源独立托管**：业务源码（index.html、js 组件）部署 OBS+CDN
- **分层（对标 Angular）**：WebComponent(LitElement) 只渲染视图/DOM事件，不写复杂业务逻辑；Service(普通 ESM Class) 存全局状态/接口/业务计算，与 DOM 解耦；共享工具纯 ESM 函数无状态
- **响应式**：@lit-labs/signals（细粒度信号）
- **DI**：@lit-labs/context（组件树注入）
- **路由**：@lit-labs/router History 干净URL（支持微信 OAuth 回调，需 CDN 回退规则）

### 部署拓扑
- FMODE Repose：/npm/lit/v3.x.x/、/npm/@lit-labs/context|signals|router/vx/、/npm/importmap/lit-v3.json（公共 importmap）
- OBS+CDN：index.html(入口引入 importmap)、app.js(入口)、/routes/、/components/、/services/、/utils/

### 运行流程
浏览器打开 → CDN 回退规则返回 /admin/index.html(200非302) → index.html 加载公共 importmap → 加载 app.js → import lit 依赖 → 初始化路由/Store/根组件渲染

## 二、前置基础设施（硬性）
1. FMODE Repose：.js 必须 Content-Type: text/javascript；CORS 允许业务域名；开启 HTTP/2/3；依赖按版本目录化
2. OBS+CDN History 路由：规则1 匹配真实静态资源直接返回；规则2 不存在路径返回 index.html(200，禁 302/301)；index.html head 加 base 标签（子目录部署写 <base href="/admin/">）
3. ImportMap：公共托管 FMODE Repose 全业务复用；business 的 index.html 用 <script type="importmap" src="公共importmap">

## 三、项目目录规范（无打包，src 直接上传 OBS 原样保留）
```
src/
  index.html (importmap+base)
  app.js (路由/全局DI/根组件)
  components/ (side-menu/user-card/tabs-container)
  routes/ (page-user-list/detail/404)
  services/ (auth/table/router/service.js)
  utils/ (http/storage/format.js)
```
分层约束：组件只渲染+事件+读 Signal+调 Service，禁大量业务逻辑/直接 fetch/硬编码接口；Service 纯JS 存 Signal+接口+校验+转换，不依赖 DOM/LitElement 可单测，禁导入 html 创建 DOM；utils 纯无状态函数。

## 四、核心模块规范（示例）
- Service：signal/computed/effect + 全局单例 export const authService = new AuthService()
- Context DI：createContext 令牌 + provide/consume
- 页面组件：SignalWatcher(LitElement) 混入自动响应 signal + consume(context)
- 根应用：provide 注入全局 service + Router 挂载 + 多标签

## 五、后台多标签+KeepAlive
同一 index.html 内前端路由切换不刷新；KeepAlive 用 display:none 隐藏非激活页容器，组件实例常驻，表单/内部状态不丢失。根组件维护 tabs 数组渲染所有已开标签页，由路由判断激活控制 display。

## 六、Lit 核心特性利用
html 模板(自动转义反 XSS+缓存)；css 标签(Shadow DOM 样式隔离)；ShadowDOM(DOM/CSS 隔离)；@property(组件本地 UI 状态)；⚠️ 区分：本地 UI 用 Lit property，跨组件全局业务状态用 @lit-labs/signals；requestUpdate/updateComplete(备选)；Slot 插槽(封装通用布局)。

## 七、状态管理选型
| 场景 | 方案 |
|---|---|
| 全局业务状态多页共享(登录/字典) | Signal Service + Context 注入(首选) |
| 组件本地状态(弹窗/输入) | Lit @property |
| 简单应用不想引 signals | EventTarget 简易 Store + Context |
| 一次性持久化配置 | localStorage 封装 |

## 八、开发工作流（极简）
写 JS 组件/Service/页面→同步上传 OBS+CDN→浏览器刷新即见→依赖升级：npm 更新 lit 同步 node_modules 到 FMODE Repose + 改 importmap 版本号。IDE 提示：本地 npm install lit @lit-labs/* 仅用于 TS/JS 类型提示，不打进产物。

## 九、风险与坑
1. ESM 大量小文件→Repose 开 HTTP/2；2. CORS 必配允许业务域名否则模块加载失败；3. ImportMap 现代浏览器原生，老浏览器需 polyfill；4. 勿混用多版本 lit（自定义元素冲突）；5. History 路由勿 302，必须 CDN 200 地址栏不变；6. 子目录部署必须 base href 否则相对 JS 404；7. Signal 和 Lit property 两套响应式分开，全局用 Signal，组件内 UI 用 property。

## 十、优势
零构建保存刷新即用/依赖统一托管一次上传全复用/原生 ESM 无黑盒/对标 Angular zoneless+Signal+DI 无 Zone 无庞大框架/History 干净 URL 支持微信 OAuth/ShadowDOM 样式隔离组件跨项目复用/分层清晰 /Fetch 原生不引重 HTTP 库。

## 十一、扩展方向
封装全局 HTTP 工具(token 拦截/错误处理)；封装通用弹窗/表格/表单 WebComponent 到内部组件库托管 FMODE Repose；路由守卫鉴权；全局 loading/消息提示组件 + 全局 Signal 控制。