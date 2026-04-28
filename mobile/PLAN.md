# CarbonTrack 移动端 (React Native) 开发计划

## 1. 技术栈选型
* **框架**: React Native (建议使用 Expo，便于快速整合相机、安全存储等原生功能)
* **路由**: React Navigation
* **状态管理**: Zustand (对应前端使用的方案) + TanStack Query (处理 API 请求与缓存)
* **UI 组件库**: NativeWind (便于复用 Tailwind CSS 思想) 或底层提供基础通用组件
* **网络请求**: Axios

## 2. 阶段一：基础框架与用户认证（MVP 核心）
* 项目初始化及环境配置 (`expo init` 或 `npx react-native init`)
* 基础 API 封装（配置 JWT 拦截器与 Token 刷新机制）
* **登录与注册页面**:
  * 邮箱/密码登录
  * 注册与验证码流程
* **底部导航栏 (Tab Navigation)**: 
  * 规划为：首页(Home)、记录(Record)、商城(Store)、我的(Profile)

## 3. 阶段二：核心业务 - 碳足迹记录与统计（MVP 核心）
* **首页 (Dashboard)**: 
  * 积分与碳减排总览图表 (对应 `/me/stats` 和 `/me/chart-data`)
  * 近期动态列表 (`/me/activities`)
* **碳记录提交页面 (Carbon Track)**:
  * 获取碳排放因子列表 (`/carbon-track/factors`)
  * 表单：上传活动图片、选择活动类型、计算并提交 (`/api/v1/carbon-records`)
* **碳记录历史**:
  * 历史记录列表与详情页面

## 4. 阶段三：积分兑换与徽章系统
* **商品商城**:
  * 获取商品列表与分类 (`/api/v1/products`)
  * 积分兑换商品操作 (`/api/v1/exchange`)
  * 兑换记录查询
* **徽章与任务**:
  * 每日签到机制 (`/me/checkins`)
  * 查看我的徽章 (`/me/badges`)

## 5. 阶段四：通知、客服与其他增强
* **消息中心**:
  * 消息列表与详情收件箱 (`/api/v1/messages`)
* **个人中心与设置**:
  * 编辑个人资料与选择头像 (`/me/avatar`)
  * 发起客服工单支持 (`/api/v1/tickets`)

---
**下步建议**：如果您同意此计划，我们可以使用 Expo CLI (`npx create-expo-app@latest carbon-track-mobile`) 在此目录下正式初始化项目代码。
