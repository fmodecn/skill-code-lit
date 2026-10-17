# 模块划分最佳实践

> 无构建项目最容易「长成一坨」：所有组件堆在 `components/`、所有逻辑塞进一个超大 service。
> 本篇给出**功能模块 / 通用能力 / 业务模块**的拆分准则与落地目录。

## 一、三种模块，三种归属

| 类型 | 定义 | 归属 | 是否可跨项目 |
|------|------|------|--------------|
| **通用能力（util skill）** | 与业务无关的纯能力：http、storage、format、debounce | `utils/` | ✅ 可抽成包托管 Repose |
| **通用组件（UI kit）** | 与业务无关的可复用 UI：弹窗、表格、表单、布局壳 | `components/` | ✅ 可抽成组件库 |
| **功能模块（feature）** | 一块完整业务功能：用户管理、订单、报表 | `modules/<feature>/` | ❌ 业务专属 |

> 判别法：**换一个业务项目，它还有用吗？** 有用 → 通用（utils/components）；没用 → 功能模块。

## 二、推荐目录（功能模块化）

```
src/
  app.js
  components/                 # 跨模块通用 UI
    app-shell.js
    tabs-bar.js
    base-table.js
  modules/                    # 功能模块（一块一块业务）
    user/
      page-user-list.js       # 页面组件
      page-user-detail.js
      user-service.js         # 模块内 service
      user-model.js           # 模块内数据结构/转换
    order/
      page-order-list.js
      order-service.js
  services/                   # 跨模块共享 service（全局状态）
    auth-service.js
    dict-service.js
  utils/                      # 通用能力
    http.js
    storage.js
    format.js
  index.html
```

规则：
- **模块内聚**：一个功能模块的页面、service、model 放在同一目录，便于整体搬走 / 整体删除。
- **跨模块共享**才上提到 `services/`（如 auth、字典、权限）。
- **通用 UI** 才留在顶层 `components/`；只在某模块用的组件放在该模块目录内。

## 三、模块的对外契约

一个功能模块**只暴露页面组件**（供路由挂载）与必要的 service。内部实现（子组件、model）不外泄。

```
modules/user/
  index.js            # 可选：统一出口
    export { PageUserList } from './page-user-list.js';
    export { userService } from './user-service.js';
```

- 别的模块**不要**深挖 `modules/user/内部子组件.js`。
- 需要跨模块调用的，通过模块出口或上提的共享 service。

## 四、Service 的粒度

| 粒度 | 例子 | 归属 |
|------|------|------|
| 全局域（登录、权限、字典） | `auth-service` | `services/` |
| 模块域（仅本模块用） | `user-service` | `modules/user/` |
| ❌ 万能 service | `app-service`（什么都塞） | 拆掉 |

- 一个 service 一个关注点。
- 模块 service 若被第二个模块需要 → 上提到 `services/`（**上提，而非复制**）。

## 五、什么时候抽到 Repose（组件库 / 能力包）

满足**全部**以下条件才抽：

1. ≥2 个项目在用；
2. 接口稳定（属性/事件契约不频繁变）；
3. 无业务耦合（不依赖具体业务 model / 接口）。

抽出的产物：
- **UI 组件库**：一批 `kebab-case` 自定义元素，托管到 FMODE Repose，业务用 importmap 引入。
- **能力包**：`http`、`storage` 等 utils 打成 ESM 包。

> 抽早了是负担。先用项目内 `components/` `utils/` 沉淀，稳定后再上提。

## 六、依赖方向（严格单向）

```
routes/modules  →  components  →  services  →  utils
       │                │              │
       └────────────────┴──────────────┘   禁止反向
```

- 上层可依赖下层，**下层禁止反向依赖上层**。
- `utils` 不认识 `services` / `components`。
- `services` 不 `import` Lit / 组件。
- 反向依赖一旦出现，说明职责放错了层。

## 七、模块划分 checklist

- [ ] 换业务就失效的代码，是否都收在 `modules/<feature>/` 里？
- [ ] 跨模块共享的状态是否上提到 `services/`（而非每个模块各存一份）？
- [ ] 通用 UI 是否在 `components/`，且不 import 任何业务 model？
- [ ] 依赖方向是否单向（无 `utils → services` 之类的反向 import）？
- [ ] 是否有「万能 service / 万能组件」需要拆？
- [ ] 满足复用条件的组件 / 工具，是否已考虑上提 Repose？

## 八、反模式

| 反模式 | 症状 | 修复 |
|--------|------|------|
| 上帝 service | 一个 service 上千行，改哪都怕 | 按关注点拆分 |
| 组件内联业务 | 页面组件里 assert 校验 + fetch + 拼接口 | 逻辑下沉 service |
| utils 有状态 | utils 里存了「上次结果」 | 移到 service |
| 复制粘贴跨模块 | 两个模块各有一份 tableservice | 上提共享 |
| 过早抽象 | 只有一个用户就搞组件库 | 先项目内沉淀 |
