# 场景化模块拆分示例

> 配套 [README.md](./README.md)，给出一个「运营后台」的完整拆分演练。

## 一、需求

一个运营后台，含：
- 登录 / 登出、当前用户、权限判断
- 侧边菜单（按权限过滤）
- 用户管理（列表 / 详情 / 编辑）
- 订单管理（列表 / 详情）
- 数据字典（下拉选项，多处用）
- 多标签工作区

## 二、拆分结果

```
src/
  app.js                         # 装配：provide 全局 service + 路由 + 根壳
  components/                    # 通用 UI（无业务耦合）
    app-shell.js                 # 布局壳（菜单 + 标签 + 内容区）
    side-menu.js                 # 侧边菜单（接收菜单数据，不自己拉接口）
    tabs-bar.js                  # 多标签栏
    tabs-container.js            # KeepAlive 容器
    base-table.js                # 通用表格（列配置驱动）
    base-modal.js                # 通用弹窗（slot 内容）
  modules/
    auth/
      page-login.js
      auth-service.js            # 登录态 + token + 权限码
    user/
      page-user-list.js
      page-user-detail.js
      user-service.js            # 用户 CRUD
      user-model.js              # 用户数据结构 + 转换
    order/
      page-order-list.js
      page-order-detail.js
      order-service.js
  services/                      # 跨模块共享
    dict-service.js              # 数据字典（权限/订单模块都用）
    menu-service.js              # 菜单树（app-shell 用）
  utils/
    http.js
    storage.js
    format.js
    router.js
```

## 三、归属决策演示

| 代码 | 归属 | 理由 |
|------|------|------|
| 登录态、token、权限码 | `modules/auth/auth-service.js` | 认证是独立功能域 |
| 用户 CRUD | `modules/user/user-service.js` | 仅用户模块用 |
| 订单 CRUD | `modules/order/order-service.js` | 仅订单模块用 |
| 数据字典 | `services/dict-service.js` | **跨模块**（用户、订单都拉下拉项）→ 上提 |
| 菜单树 | `services/menu-service.js` | app-shell 用，且依赖权限 → 跨模块 |
| 表格 / 弹窗 | `components/base-table.js` 等 | 无业务耦合，可复用/可抽库 |
| http / storage | `utils/` | 纯能力 |

## 四、关键交互（数据流）

```
page-user-list（视图）
  ├─ 读 dictService.roles（signal）→ 渲染筛选项
  ├─ 调 userService.fetchList(query) → 拿到数据
  └─ 渲染 base-table（传入列配置 + 数据）
        └─ 行点击 → dispatchEvent('row-click')
              └─ page-user-list 收到 → router.navigate('/users/:id')
                    └─ tabsService.open(...) + toggle 激活 → KeepAlive
```

原则回顾：
- **组件只读 signal、只转发事件**，不 fetch。
- **service 持有状态与业务**，无 DOM。
- **跨模块**的状态在 `services/`，**模块内**的在模块目录。

## 五、依赖方向检查

- `page-user-list` → `base-table`、`user-service`、`dictService` ✅（上层依赖下层/共享）
- `user-service` → `utils/http` ✅
- `utils/http` → `auth-service`（取 token）⚠️ —— 这是「工具反向依赖服务」。
  - **处理**：不改依赖方向，而是让 `auth-service` **注入** token getter 给 http，或 `http` 通过参数接收 token。
  - 例：`configureHttp({ getToken: () => authService.getToken() })` 在 `app.js` 装配时调用。这样 `utils` 不 import `services`。

## 六、可测试性验证

- `user-service` / `dict-service` 可在 Node 直接 import，mock `http` 后单测。
- `format.js` / `storage.js` 纯函数，直接断言。
- `base-table` 组件逻辑（列排序/选择）用 DOM 测试或抽纯函数到 utils 测。

## 七、演进路径（从项目内到 Repose）

1. 项目内先用 `components/base-table.js`。
2. 第二个项目也要 → 抽到独立包 `fmode-ui-table`（ESM，无构建）。
3. 托管到 FMODE Repose，两项目 importmap 引入。
4. 保持契约稳定（属性/事件版本化）。
