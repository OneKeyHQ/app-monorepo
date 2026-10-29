# 行情 Widget：实现与发布说明

iOS 和 Android 桌面小组件展示公开的 USD 行情。单币小组件显示用户选中的一项资产；自选列表小组件显示自选中前 3 项受支持的资产，不包含股票和永续合约。自选为空时，默认显示 Bitcoin、Ethereum 和 Solana。已保存的配置无效时，显示不可用状态，不擅自替换成其他自选列表。

## 数据与运行时边界

移动端的 `main` 和 `bg` JavaScript 运行时拥有独立的堆，并分别初始化。`main` 通过后台服务获取自选资产标识，再通过 `OneKeyMarketWidget.setConfiguration` 导出带版本号、字段受限的配置。导出内容不包含钱包地址、账户、余额、凭据或钱包数据库。

iOS 使用 WidgetKit 扩展，在现有的 `group.so.onekey.wallet` App Group 中存放专用文件。App 与扩展分别解码各自的数据副本；共享容器不代表共享内存。Android 的 Widget Provider 和原生后台任务使用应用私有的专用 Widget 存储。两端都可以在 JavaScript 运行时未运行的情况下获取行情。

配置包含 `schemaVersion`、`assets`、`greenUp` 和 `locale`。资产通过 `assetId`，或 `chainId`、`contractAddress`、`isNative` 的组合来标识。对于原生币，`requestTokenAddress` 是后台 Token 服务解析出的 API 请求地址表示，不替代深链中的原始资产标识。最多按自选顺序导出 20 项受支持的资产，各个小组件从该配置中选取展示内容。

行情使用现有的公开 Utility 接口。当前接口未提供可验证的行情源时间戳，因此界面上的更新时间表示“最近一次成功获取行情的时间”，不保证交易所行情本身的实时性。请求失败时保留上次成功的价格和时间；缺失价格显示为不可用，不补成零。价格和涨跌幅以十进制字符串保存。

默认资产 ID 为 `btc`、`eth`、`sol`。BTC、EVM 和 Solana 的原生币请求允许使用空 `tokenAddress`，但响应中的网络标识和原生币标记仍必须与请求匹配。

小组件使用独立的原生 HTTP 客户端，不会自动继承 JavaScript 的 IP Table/SNI 回退能力。发布前需要验证目标地区的接口可达性和网关规则。

## 添加与配置

- **iOS**：打开系统小组件选择器，搜索 OneKey，添加单币或自选列表小组件。iOS 17 及以上支持编辑所选币种和交互式刷新。iOS 16.4 的单币小组件显示自选中第一项受支持的资产，列表显示前 3 项。
- **Android**：打开桌面启动器的小组件选择器，选择 OneKey 单币行情或自选列表小组件。单币资产在原生配置页中选择。可用尺寸和具体展示方式取决于桌面启动器。
- 点击行情条目时，通过 `onekey-wallet://market_widget` 携带明确的资产标识打开 App。跳转仍需等待 App 就绪，并遵循现有的应用锁流程。

刷新由操作系统调度，可能受到省电模式和后台限制的影响。本功能不承诺固定刷新间隔，也不保持持续连接的行情流。

## Android 发布与真机验证

Android Widget 已随主 APK 打包，Provider、配置页和后台任务均已在 Manifest 中注册，不需要额外申请 Widget 专属签名、App Group 或服务凭据。构建沿用现有 Android/EAS 签名及 CI 配置。

可以先用真机安装 Release APK 验证。手动触发 `.github/workflows/release-android.yml` 时，将 `ONEKEY_ALLOW_SKIP_GPG_VERIFICATION` 和 `ENABLE_STARTUP_PROFILE` 都设为 `false`，工作流会使用 `production` 配置执行 `:app:assembleProdRelease`，生成 direct 渠道 APK，不自动提交应用商店。

该工作流通过 `eas build --no-wait` 提交构建。GitHub Actions 成功只表示提交成功，必须继续检查日志中的 EAS 构建链接，确认 APK 已生成。

当前手动触发流程固定使用 `BUILD_NUMBER=1`，包名仍为 `so.onekey.app.wallet`，因此可能无法直接覆盖设备上版本号更高的正式版。建议使用独立测试机或隔离的测试用户安装，验证桌面添加、选币、自选同步、刷新和冷启动跳转，再进行下文的长时间后台验证。

## iOS 发布配置

在 Apple Developer 账户中注册 `so.onekey.wallet.MarketWidget`，并为其启用 `group.so.onekey.wallet` App Group。分别创建以下 Provisioning Profile，使用与主 App CI 签名一致的分发证书，将各自的 Base64 编码内容保存到对应的仓库 Secret：

| 分发用途 | Profile 类型 | GitHub Secret |
| --- | --- | --- |
| 安装到已登记的测试设备 | Ad Hoc | `ADHOC_MARKET_WIDGET_PROFILE` |
| TestFlight / App Store | App Store Connect | `APPSTORE_MARKET_WIDGET_PROFILE` |

`release-ios` 初始化签名时加载 Ad Hoc Profile；进入 App Store 分发分支后，主 App、通知扩展、App Clip 和 Widget 都切换到各自的 App Store Profile，再执行 EAS 构建和自动提交。缺少 Widget 的 App Store Secret 时会明确失败，不会继续使用 Ad Hoc Profile 提交。手动触发 `release-ios` 的现有入口仍用于内部 Ad Hoc 分发。

工作流会将 `OneKeyMarketWidget` 加入本地 EAS 签名配置，并保持扩展的版本号和构建号与主 App 一致。不要将 Provisioning Profile 或签名证书提交到仓库。如果使用其他分发流程，也需要在对应的 EAS 签名配置中配置匹配的 Profile。

对主应用 `OneKeyWallet` 执行 Archive，确认产物中已嵌入 `PlugIns/OneKeyMarketWidget.appex`，且签名正确。仅扩展单独构建成功，不能证明主 App 的签名归档可用。

## 验证要求

使用标准 Mobile DevSession 验证集成后的 App。原生代码变更需要重新构建原生壳；不能仅更新 JavaScript 并沿用不包含 Widget Provider 和桥接模块的旧壳。

新增移动端 JavaScript 模块还需要更新 `bundle-registry/module-id-registry.json`。从实际 Metro 依赖图生成 module ID map 后，使用 `yarn workspace @onekeyhq/mobile module-id:update --map <module-id-map.json>` 注册新增模块；随后在严格模式下重新生成生产分包，并用 `module-id:check --map` 验证新的 map。Android 还需验证 `expo export:embed --eager --platform android --dev false`，覆盖 EAS 的前置打包入口。DevSession 和提交前检查通过，不代表发布注册表完整。

需要覆盖以下场景：

- 两种尺寸、多个实例、默认配置和空配置、移除已选资产、自选排序变化。
- 极小价格、行情缺失或部分缺失、缓存过期、离线后恢复。
- 深色模式、系统着色外观、调整小组件尺寸。
- 冷启动和热启动深链、应用锁解锁后的跳转恢复、非法资产标识、快速连续点击。
- 开启旅行模式后，不再继续展示此前选中的自选资产。

使用发布构建在真机上连续验证 48–72 小时，覆盖正常切后台、进程终止、低电量模式、重启和断网。分别记录“行情请求完成”和“小组件界面更新”的时间。模拟器刷新行为和 WidgetKit 开发者模式不能证明生产环境的刷新频率、耗电量或不同厂商设备的行为。

### 本次实现的验证结果（2026-10-28）

已通过：

- `yarn agent:check --profile commit` 全部通过。React Native 配置与深链测试共 5 个测试套件、92 项用例通过；Swift 配置、缓存、资产标识和解码测试共 53 项通过；原生壳缓存测试共 18 项通过，包括尚未被 Git 跟踪的 Widget 源码发生变化时的缓存失效检查。
- **iOS 模拟器构建**：复用此前已构建的 Pods 库，成功重新构建最终版本的主 App、MarketWidget、App Clip 和 ServiceExtension。通过仓库标准流程完成模拟器签名、打包、缓存登记和集成 DevSession 启动。这次验证并非清空所有原生依赖后从零构建。
- **iOS 界面**：小号和中号组件显示真实行情，以及完整的最近成功获取日期和时间。选币、多实例独立配置、手动刷新、自选同步，以及冷启动打开正确的 SOL 详情均通过。本地证据：[最终组件界面](ios/outputs/buildreports/screenshots/ios-widgets-final.png)、[SOL 冷启动详情](ios/outputs/buildreports/screenshots/ios-widget-cold-link-sol.png)。
- **Android 开发构建与界面**：DevSession APK 打包和启动通过。单币和列表组件显示真实价格及获取时间。手动刷新、选择 ETH/SOL、热启动跳转 BTC/SOL、进入 App 管理自选均通过。收藏 SOL 后列表同步为 SOL；原先选中的 ETH 被移除后显示不可用，配置页禁用保存；重新选择有效的 SOL 后可正常保存。
- **Android 最终修复验证**：组件标题精简为品牌名称，并保留最新 Intent，供 JavaScript 尚未就绪时收到的链接在启动后补读。两种组件标题均在桌面实际尺寸下检查通过。确认 App 主进程未运行后，点击 ETH 可打开正确的 Ethereum 详情和价格曲线，随后热启动点击 BTC 也能正确切换。本地证据：[单币组件](android/build/reports/market-widget/screenshots/android-single-final.png)、[列表组件](android/build/reports/market-widget/screenshots/android-watchlist-final.png)、[ETH 冷启动详情](android/build/reports/market-widget/screenshots/android-widget-cold-link-eth.png)。
- **Android 设备端测试**：在 API 36 上运行的 11 项 instrumentation 测试全部通过，包括 9 项 Widget 数据与存储测试，以及 2 项提前到达或连续更新的 Intent 测试。测试在目标应用沙箱中使用唯一命名、相互隔离的偏好存储，不启动 Activity 界面，也不访问钱包数据。此前出现的 Maven TLS 下载失败和测试沙箱权限问题，均已在最终成功运行前解决。
- **公开接口验证**：使用实际 Swift 请求与解码代码，从生产接口成功获取并解码 3 项默认资产。另有 8 项公开资产与 Token API 用例通过 macOS URLSession 检查，覆盖原生币空地址和合约 Token。这些接口验证与模拟器界面验证分别记录。

待验证事项与结论边界：

- 远端 DevSession 的原生壳与 vendor 资源曾返回 HTTP 404，已报告并使用本地构建回退。后续命中本地缓存，不代表此前未发生回退，也不证明远端产物已经可用。
- 尚未验证真机 iOS 签名归档、发布用 Provisioning Profile / App Group 配置，以及 48–72 小时真机刷新与耗电表现。上述模拟器结果也不代表验证清单中的其他场景已全部通过。
