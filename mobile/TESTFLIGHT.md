# TestFlight 发布说明

本文说明如何发布 iOS TestFlight 包，并启用 iOS 26 Liquid Glass 与 Passkey 登录。不要用 Expo Go 验证这两项功能；它们依赖原生模块，必须重新构建 iOS binary。

## 应用标识

- Expo project: `mobile`
- iOS bundle identifier: `CarbonRackOrg.CarbonRackApp`
- Android package: `com.carbonrack.mobile`
- Associated Domain: `webcredentials:carbonrackapp.com`
- 默认 API: `https://api.carbonrackapp.com/api/v1`
- Turnstile base URL: `https://carbonrackapp.com`

## macOS / Xcode 要求

为启用 iOS 26 Liquid Glass，并避免 native tabs 与 JS bundle 版本错配，TestFlight 构建机应使用当前稳定 Xcode 26 线：

- 推荐：macOS Tahoe 26.2 或更新版本。
- 推荐：Xcode 26.4.1 或更新的稳定版。
- 最低可理解范围：Xcode 26.0-26.3 可在 macOS Sequoia 15.6 或更新版本运行，但这些版本较旧，不建议作为 TestFlight 发布环境。
- 不建议：Xcode beta 作为面向测试用户的 TestFlight 包，除非需要验证 beta SDK 行为。

参考 Apple 官方要求：

- Xcode system requirements: `https://developer.apple.com/xcode/system-requirements/`
- Xcode 26.4.1 Release Notes: `https://developer.apple.com/documentation/xcode-release-notes/xcode-26_4_1-release-notes`
- iOS & iPadOS 26 Release Notes: `https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-26-release-notes`

## 关键原生包

- Liquid Glass: `@callstack/liquid-glass`
- Liquid Glass TurboModule: `NativeLiquidGlassModule`
- Liquid Glass native views: `LiquidGlassView`, `LiquidGlassContainerView`
- Native tabs: `react-native-screens`
- Native tab host/view names: `RNSTabsHost`, `RNSTabsScreen`
- Navigation entry: `@react-navigation/bottom-tabs/unstable`
- Passkey: `react-native-passkeys`
- Secure token storage: `expo-secure-store`
- Expo SDK: `expo`

## 发布前配置

TestFlight 构建前，确认 `mobile/.env` 或构建环境包含：

```env
EXPO_PUBLIC_API_URL=https://api.carbonrackapp.com/api/v1
EXPO_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA0wcgSIUML5Ocs3
EXPO_PUBLIC_TURNSTILE_BASE_URL=https://carbonrackapp.com
EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS=true
EXPO_PUBLIC_ENABLE_NATIVE_LIQUID_GLASS=true
```

默认仓库配置把两个 native 开关设为 `false`，是为了让 Expo Go 和未重建的旧 dev client 不因为缺少 `NativeLiquidGlassModule` 或 native tabs 新签名而崩溃。只有 TestFlight 或重新构建后的自定义 dev client 才应设为 `true`。

开发模式不再强制回退 JS tabs。使用 EAS development build 且两个 native 开关为 `true` 时，开发包也会尝试加载原生 tabs 与 Liquid Glass；Expo Go 或旧 binary 加载失败时仍会回退到 JS tabs / 普通半透明视图。

## Windows + iPhone 开发包验证

如果没有 macOS / Xcode，本地 Windows 只负责触发 EAS 云构建和启动 Metro，iOS 原生编译在 EAS 上完成。

1. 登录 EAS：

```bash
npx eas-cli login
```

2. 如项目尚未初始化 EAS，先执行：

```bash
npx eas-cli build:configure
```

3. 登记 iPhone 到 internal distribution 设备列表：

```bash
npx eas-cli device:create
```

4. 构建 iOS development client：

```bash
npx eas-cli build --platform ios --profile development
```

仓库内 `eas.json` 的 `development` profile 已配置：

- `developmentClient: true`
- `distribution: internal`
- `ios.image: latest`
- `EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS=true`
- `EXPO_PUBLIC_ENABLE_NATIVE_LIQUID_GLASS=true`

5. iPhone 安装 EAS 生成的 development build 后，在 Windows 上启动 Metro：

```bash
pnpm start:dev-client
```

或等价执行：

```bash
pnpm start -- --dev-client
```

注意：development build 可以验证原生模块是否正确打入 binary。iOS 26 Liquid Glass 的最终系统视觉仍取决于 EAS 当前 `latest` iOS image 是否使用 Xcode 26 或更新版本。

## 构建步骤

0. 在构建机确认版本：

```bash
sw_vers
xcodebuild -version
xcode-select -p
```

期望输出至少满足：

- `ProductVersion` 为 `26.2` 或更新，或已确认使用兼容的 macOS Sequoia 15.6+ 与 Xcode 26.0-26.3。
- `Xcode` 为 `26.4.1` 或更新稳定版。
- `xcode-select -p` 指向当前 Xcode，例如 `/Applications/Xcode.app/Contents/Developer`。

1. 安装依赖：

```bash
pnpm install --frozen-lockfile
```

2. 检查 Expo 配置：

```bash
pnpm exec expo config --type public
```

3. 确认 Apple Developer 配置：

- App ID 启用 Associated Domains。
- Bundle ID 为 `CarbonRackOrg.CarbonRackApp`。
- Provisioning profile 包含 `com.apple.developer.associated-domains`。
- `app.json` 内保留 `ios.associatedDomains=["webcredentials:carbonrackapp.com"]`。
- `https://carbonrackapp.com/.well-known/apple-app-site-association` 包含 `webcredentials` 配置，并覆盖 `CarbonRackOrg.CarbonRackApp` 所属 Team ID 与 bundle identifier。

4. 构建 iOS 原生包。核心要求是使用上面指定的 macOS / Xcode 环境重新执行 prebuild/native build，让 CocoaPods 安装上面列出的 native packages。

```bash
npx eas-cli build --platform ios --profile production
```

5. 上传 TestFlight：

```bash
npx eas-cli submit --platform ios --latest
```

## 验证 Liquid Glass

- 在 iOS 26 设备或模拟器上打开 TestFlight 包。
- `EXPO_PUBLIC_ENABLE_NATIVE_LIQUID_GLASS=true` 时，`@callstack/liquid-glass` 应注册 `NativeLiquidGlassModule`。
- `EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS=true` 时，底部导航走 `RNSTabsHost` / `RNSTabsScreen`，并使用 SF Symbols。
- 如果日志出现 `NativeLiquidGlassModule could not be found`，说明运行的是 Expo Go、旧 dev client，或 TestFlight 包没有重新构建进 `@callstack/liquid-glass`。
- 如果日志出现 `expected dynamic type 'boolean', but had type 'string'`，优先检查是否旧 binary 加载了新 JS bundle；重新安装最新 TestFlight 包，或临时把 `EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS=false` 回退到 JS tabs。

## 验证 Passkey 登录

- iOS 设备必须登录 iCloud Keychain，且系统允许 Passkeys。
- `CarbonRackOrg.CarbonRackApp` 的 Associated Domains 必须在签名后的 entitlements 中可见。
- 后端接口必须可用：
  - `POST /api/v1/auth/passkey/login/options`
  - `POST /api/v1/auth/passkey/login/verify`
- 先在网页或移动端完成 passkey 注册，再在登录页点击 Passkey 登录。
- 如果 `react-native-passkeys` 返回不可用，检查 TestFlight 包是否包含原生模块、Associated Domains 是否生效、AASA 文件是否可被 Apple CDN 拉取。

## Debug 清单

- JS 包名：`mobile`
- iOS bundle identifier：`CarbonRackOrg.CarbonRackApp`
- Native module：`NativeLiquidGlassModule`
- Native package：`@callstack/liquid-glass`
- Native tabs package：`react-native-screens`
- Tabs host：`RNSTabsHost`
- Tabs screen：`RNSTabsScreen`
- Passkey package：`react-native-passkeys`
- Associated Domain：`webcredentials:carbonrackapp.com`
- AASA URL：`https://carbonrackapp.com/.well-known/apple-app-site-association`
- API base URL：`https://api.carbonrackapp.com/api/v1`
