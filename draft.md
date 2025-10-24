# 草稿与分析记录

## 任务: 进一步完善 functional_test_plan.md

### 当前阶段
已经完成了对 API、数据库、部分前端组件和 TODO 列表的分析。用户要求继续寻找缺失的测试点。

### 下一步计划
深入分析后端核心服务 (`/backend/src/Services`)，以发现更细微的业务逻辑。

1.  **当前目标:** 分析 `CarbonCalculatorService.php`，理解积分计算的具体逻辑。
2.  **后续目标:**
    *   分析 `BadgeService.php`，核实徽章授予的完整条件。
    *   分析 `StatisticsService.php`，理解后台统计数据的生成方式。
    *   分析 `AuthService.php`，寻找认证流程中可能存在的安全或逻辑漏洞。
    *   检查集成测试 (`/backend/tests/Integration`)，从中发现被忽略的复杂业务场景。

### 从 CarbonCalculatorService.php 中发现的测试点：

1. **积分计算的精确性**: 
   - 公式: `points = carbon_savings × 10`
   - 需要测试边界值，如 `carbon_savings = 0.05`，应得 `0` 还是 `1` 分？（代码中使用了 `round()`）

2. **负数输入的异常处理**:
   - `dataInput < 0` 会抛出 `InvalidArgumentException`
   - 需要测试前端和后端是否正确捕获并向用户提示

3. **活动查询的高级参数**:
   - `includeInactive`: 是否包含未激活的活动
   - `includeDeleted`: 是否包含已软删除的活动
   - 这些参数在管理员后台可能会用到，但前端用户不应访问

4. **活动的排序逻辑**:
   - 按 `category` → `sort_order` → `created_at` 三级排序
   - 需要测试这个排序在前端活动选择器中是否正确体现

5. **单位转换功能**:
   - 虽然实现简单，但存在 `convertUnits()` 方法
   - 需要测试是否在某些场景下被使用（如 km 转 m）

---

### 前端路由与布局分析发现：

1. **导航栏（Navbar）交互逻辑**  
   - 桌面端与移动端菜单状态同步；移动端需验证 unread badge 展示  
   - 语言切换器 (LanguageSwitcher) 的即时翻译更新  
   - 登录状态对导航项过滤、用户菜单、管理员入口显示的影响  
   - 登出流程需要 mock `authAPI.logout` 并校验跳转 `/auth/login`

2. **引导页（`/onboarding`）**  
   - 未完善资料的用户应被重定向至该页，已完善者访问时自动跳转仪表盘  
   - 学校搜索节流逻辑、搜索结果为空时提示  
  - 跳过引导与保存成功后 `sessionStorage` 标记处理  
   - 自定义学校名称时调用 `createOrFetchSchool`，提交后本地缓存用户信息更新

3. **认证布局 (`AuthLayout`)**  
   - 登录/注册/忘记密码等页面共享布局，需验证页眉、跳转逻辑、错误消息显示

4. **公共页面 (`/`, `/about-us`, `NotFound`)**  
   - 首页公告与推荐卡片加载、空状态、错误处理  
   - `NotFoundPage` 在路由未匹配时正确渲染并提供返回入口

### 已补充到测试计划的前端覆盖点摘要：
- 新增 `AuthLayout` 导航一致性、错误提示和多语言测试用例。
- 新增 `/onboarding` 引导流程的访问控制、学校搜索、自定义学校、跳过流程、错误处理与多语言测试用例。
- 其余导航栏、公共页等发现已记录在此草稿中，后续可进一步扩展。
