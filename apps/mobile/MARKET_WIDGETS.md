# 行情 Widget：实现与发布说明

iOS 和 Android 桌面小组件展示公开的 USD 行情，提供两种形式：

- **单币卡**：展示 OneKey 标识、Token 图标、所选币种、价格和 24 小时涨跌幅。
- **三行行情列表**：展示所选来源中前 3 项受支持资产，每行包含 Token 图标、币种、价格、24 小时涨跌幅和真实价格曲线。

在 iOS 17 及以上和 Android 上，来源可选“自选”或“热门”。iOS 在 App 内创建和编辑配置，不需要手动命名，桌面组件首次使用时在系统编辑页绑定配置；不同配置相互隔离，多个组件绑定同一配置时联动更新，不保证每张桌面组件强制独立。Android 按系统小组件 ID 独立保存来源和单币选择。自选沿用 App 中的资产顺序，不包含股票和永续合约；热门读取现有公开行情接口的 Trending 列表，不用固定币种或市值榜代替。单币卡选中的热门币退出榜单后仍保留原资产身份；已选自选资产被移除时显示不可用，不自动换成其他币。iOS 16.4 的兼容范围见下文。

自选为空时显示空态。配置无效、热门列表暂不可用或缺少行情时显示对应状态，不补出虚构价格、图表或资产列表。Token 图标不可用时使用占位图。

## 数据与运行时边界

移动端的 `main` 和 `bg` JavaScript 运行时拥有独立的堆，并分别初始化。`main` 通过后台服务获取自选资产标识，再通过 `OneKeyMarketWidget.setConfiguration` 导出带版本号、字段受限的配置。导出内容不包含钱包地址、账户、余额、凭据或钱包数据库。

iOS 使用 WidgetKit 扩展，在现有的 `group.so.onekey.wallet` App Group 中存放专用文件。App 与扩展分别解码各自的数据副本；共享容器不代表共享内存。Android 的 Widget Provider 和原生后台任务使用应用私有的专用 Widget 存储。两端都可以在 JavaScript 运行时未运行的情况下获取行情。

共享配置保留 `schemaVersion: 1`，包含 `assets`、`greenUp`、`locale`，并新增可选的 `privacyMasked`；缺少该字段的旧配置按未屏蔽处理。资产通过 `assetId`，或 `chainId`、`contractAddress`、`isNative` 的组合来标识。对于原生币，`requestTokenAddress` 是后台 Token 服务解析出的 API 请求地址表示，不替代深链中的原始资产标识。最多按自选顺序导出 20 项受支持的资产。各个小组件的来源与单币选择保存在原生侧，热门列表、Token 图标和曲线也由原生独立获取、缓存。

旅行模式通过 `privacyMasked` 明确区别于普通空自选。屏蔽期间，两种来源均隐藏并停止刷新，清理报价、曲线和热门列表缓存，编辑页面不展示旧资产选择。延迟到达的网络结果不得重新写入或显示被隐藏的内容。

行情使用现有的公开 Utility 接口：热门列表使用 `/utility/v2/market/trending`，资产详情使用 `/utility/v1/market/asset/detail`，链上 Token 详情使用 `/utility/v2/market/token/detail`。图标取自详情或热门数据中的 `logoUrl`。当前报价接口未提供可验证的行情源时间戳，因此显示或辅助功能中使用的更新时间表示“最近一次成功获取行情的时间”，不保证交易所行情本身的实时性。请求失败时保留上次成功的价格和时间；缺失价格显示为不可用，不补成零。价格和涨跌幅以十进制字符串保存。

24 小时曲线请求对应的 `/asset/kline` 或 `/token/kline` 接口，使用 `interval=1H`，时间范围为最近 24 小时，`timeFrom`、`timeTo` 和返回点的 `t` 均使用 Unix 秒。曲线依据真实时间戳和收盘价 `c` 绘制；`c` 兼容数字、十进制字符串和科学计数法。服务器按时间边界取整，点数不固定为 24 或 25。无效、过期或不足以反映该时间范围的数据不画成正常曲线。这是按小时采样的历史走势，不是实时逐笔行情，也不以当前价格和涨跌幅生成示意线。

BTC、EVM 和 Solana 的原生币请求允许使用空 `tokenAddress`；SUI 等币种保留接口返回的原生地址表示。响应中的网络、资产标识和原生币标记仍须与请求匹配。

小组件使用独立的原生 HTTP 客户端，不会自动继承 JavaScript 的 IP Table/SNI 回退能力。发布前需要验证目标地区的接口可达性和网关规则。

### API 用量与优化（2026-10-30）

计数口径是设备向 OneKey Utility 发起的 HTTP 请求次数，不等于服务端向行情供应商发出的请求次数或计费额度。Token 图标的 CDN 请求、普通 App 行情页面流量、编辑操作和失败后的额外刷新另计。以下按单台设备、单个有效 Widget、列表满 3 行、缓存过期后正常成功刷新估算；每周为 7 天，每月为 30 天，不是生产日志实测值。

第一轮只为列表请求曲线。iOS 的价格与曲线分别缓存、合并并发请求；同币单币卡先更新价格后，列表仍能补齐曲线，后续单币更新也不会覆盖已有曲线。曲线成功缓存为 15 分钟，失败时沿用 1 小时内的真实历史数据。Android 汇总所有组件对同一资产的需求，只要至少一个列表需要该资产，就保留一次曲线请求。

第二轮让明确固定币种的热门单币卡直接刷新所选资产；热门列表和没有明确选择币种的默认热门单币仍刷新榜单。选中的币退出榜单后仍保留身份。Android 对规范化后的配置做完整比较，相同配置同步不再取消并重建刷新任务；有列表时由列表 Provider 发起周期刷新，没有列表时由单币 Provider 发起，后台任务仍刷新全部实例所需的资产。新增、恢复、编辑保存与真实配置变化保留及时刷新，最后一个列表移除后立即交给剩余单币卡。

第三轮让 iOS 编辑器复用已缓存热门榜中完全相同资产 ID 的显示信息。只补齐缺失的简称、名称和图标地址，保留输入资产的请求身份；已有字段优先，不按币种简称或相似名称合并。该优化降低打开编辑器时的详情补全请求，不改变下表的周期用量。

| 平台 | 类型 | 每轮 API | 24 小时 | 7 天 | 30 天 | 相比优化前 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| iOS | 自选单币 | 1 | 96 | 672 | 2,880 | 减少 50% |
| iOS | 热门单币，已选定币种 | 1 | 96 | 672 | 2,880 | 减少约 67% |
| iOS | 自选三行列表 | 6 | 576 | 4,032 | 17,280 | 单实例周期用量不变 |
| iOS | 热门三行列表 | 7 | 672 | 4,704 | 20,160 | 单实例周期用量不变 |
| Android | 自选单币 | 1 | 48 | 336 | 1,440 | 减少 50% |
| Android | 热门单币，已选定币种 | 1 | 48 | 336 | 1,440 | 减少约 67% |
| Android | 自选三行列表 | 6 | 288 | 2,016 | 8,640 | 单实例周期用量不变 |
| Android | 热门三行列表 | 7 | 336 | 2,352 | 10,080 | 单实例周期用量不变 |

表中 iOS 按请求的 15 分钟间隔，即每天 96 轮计算，Android 按 30 分钟间隔，即每天 48 轮计算，均不是固定实际频率或上限。尚未选定币种的默认热门单币每轮仍为 2 次请求，对应 iOS 的 192／1,344／5,760 次和 Android 的 96／672／2,880 次。

Apple 对经常查看的 Widget 给出的典型预算是每天 40–70 次刷新，实际预算按实例动态分配，前台等刷新还可能不计入预算。以该范围代入，iOS 已选定的单币卡约为每天 40–70 次、每周 280–490 次、30 天 1,200–2,100 次 API；不能把 70 次当成硬上限。Android 的广播和 Job 同样会被系统延迟。参见 [Apple 刷新说明](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date) 和 [Android 刷新说明](https://developer.android.com/develop/ui/views/appwidgets/advanced)。

多实例不能简单按卡片数量相乘。Android 在同一轮内按资产身份去重：设全部展示资产的去重数量为 U，列表使用的去重资产数量为 C，是否存在需要榜单的组件为 H（0 或 1），则每轮约为 `U + C + H` 次。若热门 BTC 单币和热门列表包含完全相同身份的 BTC，另外两行为 ETH、SOL，则一轮仍为 7 次、一天约 336 次；不会再因两类 Provider 错峰广播多跑一轮。资产列表身份 `assetId` 与链上 Token 身份不是同一个缓存键，即使都叫 BTC 也不能按名称合并。iOS 同进程请求和共享文件缓存可减少重复请求，但 App 与扩展的内存请求队列独立，不能承诺跨进程完全去重。

编辑器打开、主动重试、保存、资产或隐私设置改变均可能产生表外用量。没有已安装组件、也没有打开编辑器或组件预览时，不产生周期 Widget 行情请求。图标使用独立缓存，iOS 缺图时下载，Android 通常 7 天后重取，失效和缓存清理会增加请求。继续评估批量接口时，必须分别验证资产与 Token 的身份匹配、部分失败和缓存复用；当前 Token 批量接口不能直接接收 `assetId`。

复查后仍有批量报价的优化空间：现有 `/utility/v2/market/token/list/batch` 可作为 Token 详情请求的替代候选，但不能提供带时间戳的 24 小时曲线，也不能覆盖资产列表身份。若三个条目均为 Token 且接口契约验证通过，热门列表每轮可由 7 次降至 5 次，自选列表由 6 次降至 4 次。当前尚未切换：需要验证批量限制、原生币地址表示、逐项响应身份及缺失条目的独立降级；响应可能省略未知 Token，不能按数组下标配币。这属于后续接口整合，不计入本轮已实现的节省。

## 添加与配置

- **iOS 17 及以上**：在 App 的“设置 → 偏好设置 → 行情小组件”创建配置，选择自选／热门来源，单币配置支持搜索选币，列表显示来源中的前 3 项。表单没有 Name／名称字段；每次保存时，内部名称按“来源 + 币种”自动生成，列表配置按“来源 + 行情列表”自动生成。然后在桌面添加 OneKey 小组件，长按选择“编辑小组件”，首次绑定对应类型的配置。系统页负责选择绑定，来源和币种统一在 App 编辑。单币卡齿轮通过配置 ID 打开对应表单，其他区域继续打开行情详情。多个组件绑定同一配置时一起更新；需要独立设置时创建不同配置，并分别绑定。
- **iOS 旧实例升级**：保留原 Intent 的来源、币种参数及实体标识；未绑定 App 内配置的旧实例继续按原选择显示。点击其齿轮进入配置管理，创建配置后需在系统编辑页手动绑定，不会根据币种猜测两个旧实例是否属于同一配置。无效绑定不能静默变成另一配置。
- **iOS 16.4**：使用兼容的静态 WidgetKit 配置，单币卡跟随自选第一项，列表跟随前 3 项；这一系统版本暂不提供独立来源、单币选择和组件内编辑入口。
- **Android**：在桌面启动器的小组件选择器选择 OneKey 单币卡或三行列表。添加及点击组件编辑入口时打开原生配置页，可切换自选／热门，单币卡支持搜索选币。新实例以热门作为初始来源，已有实例保留原配置。编辑页和行情获取不依赖 React Native 页面保持运行。尺寸和缩放效果受桌面启动器影响。
- 点击行情条目时，通过 `onekey-wallet://market_widget` 携带明确的资产标识打开 App。行情跳转等待 App 就绪，并遵循现有的应用锁和旅行模式检查。

iOS 配置由主 App 的原生桥接保存在 App Group 独立的 `profiles-v1.json` 中；首次保存生成一次 UUID，后续保存保持 ID 不变。`profileId` 是配置标识，不是系统小组件实例 ID。自动生成的名称用于展示，不作为配置身份；不同配置即使名称和选项相同也相互隔离，多个组件绑定相同 `profileId` 则共用修改。系统 AppIntent 持有该引用，时间线按 ID 读取当前配置。普通的自选同步仍写入 `configuration-v1.json`，不会覆盖 App 内配置。App 内表单只在点击保存时写入，取消不改变桌面设置或内部名称。

编辑链接使用 `onekey-wallet://market_widget_config?profileId=<UUID>`；未绑定实例使用 `?kind=single` 或 `?kind=list` 进入对应类型的管理页。参数严格校验，旧原生版本及 iOS 16.4 不开放该编辑能力。编辑与行情链接共用解锁、旅行模式和最新请求检查。

组件使用系统后台调度刷新；编辑或自选配置变更会请求重新加载，最终刷新时机仍由系统决定。省电模式、进程状态和后台限制均可能影响更新。本功能不承诺固定刷新间隔，也不保持持续连接的行情流。

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

在已有 Widget 测试数据的 Android 模拟器上运行 instrumentation 前，必须确认测试工具不会在结束时自动卸载主 App。优先安装测试 APK 后显式执行指定 instrumentation，保留主 App 和桌面绑定；公开 Widget 配置备份不能恢复钱包数据或系统分配的旧 Widget ID。

每轮视觉修改都执行“原始参考截图 → 原生构建安装 → 实际界面截图 → 像素量测 → 修正复验”。卡片按相同高度等比展示，编辑页按相同屏幕宽度比较，保留原始宽高比；记录图标尺寸、文字可见边界、内边距、列位置、分隔线和曲线样式，并保存对比图与测量结果。发现新的布局偏差时继续修正，不能只凭源码参数或构建成功判定视觉通过。不同 Launcher 的卡片比例、系统合成边框、品牌替换及真实行情数据分别说明，不用拉伸截图、固定假行情或全图像素差来掩盖这些条件。编辑页还需实测来源切换、搜索、键盘弹出与收起、选币保存及返回桌面。

新增移动端 JavaScript 模块还需要更新 `bundle-registry/module-id-registry.json`。从实际 Metro 依赖图生成 module ID map 后，使用 `yarn workspace @onekeyhq/mobile module-id:update --map <module-id-map.json>` 注册新增模块；随后在严格模式下重新生成生产分包，并用 `module-id:check --map` 验证新的 map。Android 还需验证 `expo export:embed --eager --platform android --dev false`，覆盖 EAS 的前置打包入口。DevSession 和提交前检查通过，不代表发布注册表完整。

需要覆盖以下场景：

- 两种尺寸、多个实例、默认配置和空配置、移除已选资产、自选排序变化。
- 极小价格、行情缺失或部分缺失、缓存过期、离线后恢复。
- 深色模式、系统着色外观、调整小组件尺寸。
- 冷启动和热启动深链、应用锁解锁后的跳转恢复、非法资产标识、快速连续点击。
- 开启旅行模式后，不再继续展示此前选中的自选资产。

使用发布构建在真机上连续验证 48–72 小时，覆盖正常切后台、进程终止、低电量模式、重启和断网。分别记录“行情请求完成”和“小组件界面更新”的时间。模拟器刷新行为和 WidgetKit 开发者模式不能证明生产环境的刷新频率、耗电量或不同厂商设备的行为。

### API 优化验证（2026-10-30）

- Swift 数据、服务及时间线检查共 185 项通过，包括单币无曲线请求、单币先请求后的列表补图、并发请求合并、价格与曲线时间戳独立、固定／默认热门来源的实际请求计数、元数据复用和隐私变化。完整 Widget 源码的 iOS 16.4 typecheck 通过。
- Android instrumentation 共 21 项通过，包括规范配置比较、资产需求合并、后读资产信息保留、固定／动态热门来源及周期刷新入口交接。结果保存在 `android-api-optimization-instrumentation.log`。
- iOS 主 App 与 Android 原生构建成功；`yarn agent:check --profile commit` 全部通过。本轮没有触发远端 CI 或发布，也没有做 24 小时请求日志采样，前文的日／周／月数字仍为代码模型。
- iOS 新原生壳完成实际单币、三行曲线和编辑回归：热门 BTC 改为 ETH 后仅对应卡片更新，随后恢复 BTC；另一张自选 ETH 和列表保留。最终截图为 `ios-api-optimized-home-final.png`，编辑页为 `ios-api-optimized-editor-before.png`。
- Android 重建后完成原生界面回归：热门 BTC 搜索、选择和保存后返回桌面；自选列表 SOL／ETH／BTC 的三份报价、图标和曲线正常；已有列表临时切换热门后取消，仍保持原自选来源。截图为 `android-api-optimized-single.png`、`android-api-optimized-list-cancel.png`，恢复详情为 `android-api-optimized-recovery.json`。
- Android 两次下载远端原生壳返回 HTTP 404，均回退到本地构建。iOS 标准 DevSession 曾等待另一设备释放共享准备锁，之后正常启动；旧 8083 Metro 残留导致的一次启动端口冲突已清理。不能把整个过程描述为无提示的缓存命中。
- Android 的 `connectedProdDebugAndroidTest` 在测试结束后自动卸载了 `emulator-5554` 内主 App，未保留 App 数据，系统 Widget 绑定也被清除。随后重新安装 App，通过正常星标操作恢复公开自选，并在 Launcher 重建热门 BTC 单币与自选列表（旧 ID 5／6 对应新 ID 9／10）；另三张原测试卡未重建，自选顺序由 BTC／ETH／SOL 变为 SOL／ETH／BTC。旧公开 Widget 配置备份不包含钱包等其他 App 数据，也不能恢复原 Widget ID；不能把重建描述为原状态无损恢复。重新安装后的 React Native 开发会话出现 RevenueCat LogBox 及间歇黑屏，未将该 App 导航路径记作通过；上述 Android 界面结果为原生 Widget 与原生编辑器验证。后续设备测试应使用保留 APK 的显式 instrumentation 流程。

### App 内编辑与配置绑定验证（2026-10-30）

最终编辑页移除了常驻的配置联动说明，只保留来源、币种／列表预览以及取消和保存操作；保存失败时仍显示错误信息。iOS 实际布局已复验，截图为 `ios-editor-simple-final.png`。

移除 Name 字段后的复验已完成：iOS 编辑页只保留来源和币种（列表展示来源预览），将热门 BTC 改为 BNB 并保存后，原配置 UUID 不变、名称自动更新为 `Hot coins · BNB`，对应桌面卡片显示 BNB，另一张 ETH 卡片保持原币种；随后通过搜索恢复 BTC，名称同步恢复为 `Hot coins · BTC`。选币与表单切换时固定 Page 结构，修复了滚动容器切换导致 Footer 重挂载的渲染警告。保存与编辑生命周期测试 2 个套件、13 项通过，`yarn agent:check --profile commit` 全部通过。本次仅更新 JavaScript 界面与文案，使用既有原生壳验证，没有重新触发原生构建或发布。截图为 `ios-editor-no-name-final.png` 与 `ios-auto-name-saved-bnb.png`。

以下保留移除 Name 字段前的验证记录：当时已将 iOS 17 及以上的日常编辑迁移到 App，名称使用 `Form.Input`，来源使用 `Select`，选币使用 Token 行与 `SearchBar`，底部使用 Page 的取消／保存按钮。编辑页按 OneKey 设计系统实现，不再按币安编辑页逐像素复制。单币卡的设置图标与价格分别打开配置和行情；系统编辑页只负责首次绑定。新增文案按当前约定集中在 `useMarketWidgetCopy.ts`，暂时硬编码中英文，后续统一接入翻译流程，未修改生成的翻译文件。

后续产品约定移除 Name／名称字段，内部名称在每次保存时按来源和币种自动生成，列表使用来源和“行情列表”；保留首次系统绑定、不同配置隔离与同一配置联动。下列测试数量、界面结果和截图记录不代表这次去除 Name 字段后的新增验证。

已完成的实际界面检查：

- iOS 原有 Watchlist ETH、Hot BTC 和三行自选列表在安装新原生构建后保留显示；未绑定实例没有自动迁移或猜测共享关系。
- 从桌面设置入口打开已绑定配置；切换来源、搜索 ETH、选币后取消，重新打开仍为原 Hot BTC。保存 SOL 后仅对应卡片变化。两个单币卡绑定同一配置时，保存会同时更新；重新绑定不同配置后保持独立。
- 列表绑定页只列出列表配置，单币绑定页只列出单币配置；列表来源切到热门后显示真实 Trending 币种及各自曲线，随后恢复自选。
- 从“偏好设置 → 行情小组件”进入管理页、创建单币与列表配置均已实测。选币页返回保留表单，根编辑页 X 可关闭；iOS 26 根模态的按钮使用现有玻璃导航按钮接口。
- iOS 无钱包状态下的冷启动设置链接已验证，编辑页保持稳定超过 35 秒；冷启动点击价格进入 BTC 详情，真实价格和 1D 曲线正常显示。修复了异步启动检查晚于深链导航返回时覆盖目标页面的问题，包括页面尚未加载完成的中间导航状态；钱包清除和 V4 迁移路径保留。
- iOS 设置图标按 500px 卡片高度归一化后，参考边界为 `[311,55,357,105]`，最终实拍为 `[312,54,357,105]`，宽高差为 −1／+1px；品牌替换和系统边框差异保留。
- Android 旧列表从卡内编辑入口进入时保留 My watchlist，取消和确认均保持来源；Launcher 实际新建单币默认 Hot，取消不会留下新卡。原生 instrumentation 共 15 项通过。
- Android 从 More 切后台再点 BTC 卡，能够自动关闭顶层 More 并显示真实价格、1D 曲线、市值与成交量。关闭逻辑仅处理这个已确认的覆盖页，不清除其他交易或引导流程。

配置保存还覆盖了前后台竞态：原生成功回执即使晚于页面失焦，也保留返回的配置 UUID；恢复后再次保存更新同一配置，不创建重复条目，也不在旧页面失焦后执行导航。深链继续遵守解锁、隐私屏蔽与最新请求检查。

`yarn agent:check --profile commit` 全部通过；JavaScript 深链、原生桥接、配置同步、编辑生命周期与启动引导测试共 10 个套件、154 项通过。Swift 数据与服务检查共 147 项通过；iOS 主 App 本地原生构建及完整 Widget 源码的 iOS 16.4 编译检查通过。生产 Metro 图已注册 7 个新运行时模块，既有 ID 和 tombstone 不变；iOS 严格图检查、Android 主／后台生产分包和 EAS 对应的 eager 导出入口通过。

本地截图与参考对比保存在 `market-widget-redesign-verification` 目录：`ios-app-editor-comparison-final.png` 为 App 编辑页对比，`ios-widget-gear-comparison-final.png` 为桌面卡片对比；`ios-profile-shared-btc.png` 和 `ios-profile-independent-sol.png` 分别记录共享与独立配置；`ios-final-editor-clean.png`、`ios-cold-price-final.png` 和 `android-deeplink-more-fixed-loaded.png` 记录最终编辑页与两端跳转结果。截图保留原始比例和真实行情。

环境与遗留边界：

- 本轮 iOS vendor 和 Android shell 的远端 locator 曾返回 HTTP 404，标准 DevSession 已自动回退本地构建并成功启动；后续命中本地缓存不代表整轮未发生回退。
- Android 无配置记录的历史实例如果直接从 Launcher 长按重配，其标准 Intent 与首次添加没有新建／重配标记。卡内编辑入口及已有显式保存配置的实例已处理；该历史 Launcher 入口仍需在目标启动器验证。
- 模拟器已有开发模式路由、RevenueCat 和网络限速提示不属于 Widget 的编译或模块加载失败。Jest 用例通过后仍输出既有 open-handle 提示。
- 本轮未触发远端 CI 或发布；发布包签名、真机长期后台刷新及各厂商 Launcher 仍按上面的发布前清单验证。

### 上一轮卡片改版验证（2026-10-29）

已完成的检查与构建：

- `yarn agent:check --profile commit` 全部通过。
- JavaScript 配置同步与深链测试：4 个测试套件、28 项用例通过。
- Swift 数据与服务检查：84 项通过，覆盖超过 1 小时的曲线隐藏、至少 12 个有效点且跨度至少 18 小时的曲线要求，以及详情请求等待期间发生隐私屏蔽、资产移除或自选清空后，不再启动曲线和图标请求。正常对照路径实际发出详情、曲线、图标共 3 个请求。
- Android instrumentation 测试：13 项通过。
- iOS 和 Android 均完成应用级本地原生构建，并通过标准 Mobile DevSession 启动主 App。iOS 最新默认来源修正已完成主 App 增量构建，重启模拟器后通过独立 Metro 8083 的 DevSession 启动，并完成最终界面复验。

已完成的界面验证：

- **Android**：在运行的 OneKey App 中配置真实的 BTC、ETH、SOL 自选，确认同步至组件；检查 2×2 单币卡和 4×2 三行列表、来源切换、搜索选币、多实例独立配置，以及保存和返回均回到桌面启动器。从热门 BTC 的 Token 身份和自选 ETH 的资产身份点击跳转，均打开对应的真实行情详情，显示价格及 1D 曲线。
- **iOS**：在运行的 OneKey App 中添加 BTC、ETH、SOL 自选，检查系统“编辑小组件”的 Source 切换、搜索 BTC 并保存、列表切换到自选，并取得两种组件显示真实行情的截图。新增单币实例选择 Watchlist ETH 后，已有 Hot BTC 单币卡及 BTC、ETH、SOL 三行自选列表保持不变，已通过实例隔离截图核对。Hot BTC 单币卡及自选列表 ETH 分别打开 Bitcoin、Ethereum 详情，均显示真实价格和 1D 曲线。
- **iOS 默认来源修正**：系统编辑页曾将初始 Source 显示为占位项，现已通过 `@Parameter` 默认值设为热门，并完成生成元数据检查及最终安装验证；新建未选择来源的实例在系统编辑页明确显示 Hot Coins。旧实验版本未选择来源的实例按热门处理，明确选择自选的实例仍保留自选；已有自选列表仍显示 BTC、ETH、SOL。
- **版本范围**：iOS 17 及以上支持两种来源和独立系统编辑；iOS 16.4 仅保留跟随自选的兼容显示，不支持独立来源配置。
- **像素对齐复验**：随后完成 iOS 两轮、Android 三轮原生构建与实截图比对。按卡片高度 500px 等比量测，单币图标、BTC 行、价格及列表列位置等主要锚点偏差约为 0–3px；Android 编辑页按相同屏幕宽度量测，最终搜索框顶部一致，首币名顶部相差 1px。比对保留原始比例，品牌、语言、真实资产与行情以及系统渲染差异单独说明。
- **编辑与尺寸回归**：最终 Android 编辑页实测自选来源搜索 ETH、键盘弹出、选币保存返回桌面，再恢复热门 BTC；其他实例保持原配置。窄列表和拉高组件也进行了截图检查，价格与曲线没有重叠，过长币全名按单行省略。iOS 最新卡片点击 BTC 后显示对应价格和 1D 图表。

环境与验证边界：

- 远端原生壳曾返回 HTTP 404，Android 远端资源拉取也曾失败，随后回退到本地构建；构建期间还曾等待共享准备步骤。这些结果不代表远端资源已恢复，也不是一次全程命中缓存的验证。
- iOS 全量 Specs 仓库克隆已中止，后续使用已安装的 Pods，且 `Manifest.lock` 与 `Podfile.lock` 一致。因此本轮不是清空全部依赖后的从零构建。
- iOS 初次使用 Metro 8081 时受到 Android HMR 连接串线影响，启动失败；改用独立的 8083 后成功启动。
- 像素对齐后的 iOS 点击验证期间出现过一次开发环境网络超时提示和 Metro 设备连接超时日志，随后行情详情正常加载；本轮未修改这条网络链路。
- 本轮未触发远端 CI，未验证发布签名归档，也未完成 48–72 小时真机后台刷新、电耗及不同 Android 厂商设备的行为验证。上述本地检查和界面结果不替代这些发布前验证。

### 历史实现的验证结果（2026-10-28，不代表本轮改版验证）

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
