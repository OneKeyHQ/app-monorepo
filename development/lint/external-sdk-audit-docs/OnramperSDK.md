# Onramper SDK 审计与源码重建结论

> 审计日期：2026-11-06（Asia/Shanghai）
> 对象：`@onramper/onramper-react-native@1.3.1` 随包分发的 `OnramperSDK.xcframework`
> （Mach-O arm64 dylib，sha256 `6a12598c0390731b8951109e69dec5d75377bd960de0d801826274dfd776243f`，
> UUID `2850C974-35F4-3E91-99A5-439265A56D20`，Swift 6.2.4，MinimumOSVersion 16.0）
> 以及 Android 侧实际的 Onramper 接入面。
>
> 本文档是本轮工作的**统一结论**：安全审计结论 + 反编译/重建拆分结果 + 外部 SDK
> 完整性 lint 说明。详细证据与可读重建源码作为内部审计交付物保留（见 §10），
> 不随本 PR 提交。

> **反编译审计声明（本 PR 公开披露）**：我们对上述闭源 `OnramperSDK.xcframework`
> 做了静态逆向安全审计——使用随包 dSYM/DWARF、`.swiftinterface`、`otool`/`llvm-objdump`
> 反汇编、Mach-O bind 表、ObjC 元数据和字符串交叉验证，并在此基础上产出本结论、
> 外部 SDK 完整性 lint 与重建源码。本 PR **不包含** Onramper 的原始或重建源码；
> 重建源码作为内部审计交付物单独保存（见 §10）。
>
> **审计覆盖范围**：iOS 原生二进制（静态审计）+ Android 实际接入面（无原生 SDK，
> 审计远程 web widget 与 WebView/Manifest 配置）。详见 §5。

## 0. 结论速览

1. **静态负面证据有边界**：本次 arm64 二进制的 imports/bind、ObjC 元数据与已审查
   调用点中，未发现 UIPasteboard、CoreLocation、ATT/IDFA、Contacts、Photos、
   AVFoundation 原生采集 API。不能据此证明远程网页、动态解析或未来版本没有这些行为。
2. **原版 WebView 媒体授权仍需处理**：`InternalAuthWebView` delegate 入口
   `0xa8ce8`，在 `0xa8d14` 设置 `.grant` 参数、`0xa8d18` 调用 handler，未校验 origin。
   这是 WebKit 层的授权，不代表绕过 iOS 的 App 权限/usage description，也不是实测摄像头已开启。
   新窗口 URL 未校验、checkout 终态采用 URL 子串识别也需要独立整改。
3. **设备标识会发送**：IDFV、机型、系统、屏幕、语言、时区参与哈希后进入
   `X-Onramper-Device`。无 IDFA/ATT 绑定不能证明服务端不会关联身份或跨站数据；
   `NSPrivacyTracking=false` 是声明，不能由静态客户端证据认证其合规性。
4. **限定的正面证据**：安全端点 session 的 SPKI-SHA256 pin mismatch、策略设置失败、
   trust evaluation 失败走 cancel；非 server-trust / `serverTrust == nil` 走 default handling。
   主 BFF 与 provider WebView 不在该 pinning 覆盖内。`isEventLoggingEnabled=false`
   门控的是 `v1/checkout/events`，不关闭设备指纹、业务请求、远程页面统计或 OneKey 自己的日志。
5. **Android 未发现原生 Onramper SDK**：当前包、仓库 Gradle 配置和已检查的本机缓存
   未发现其 AAR/JAR/SO。实际接入是后端 URL → WebView；不能外推为任何机器或公共渠道均不存在。
6. **重建是候选替代实现**：现存接口产物重新对比为 360 declarations / 142 conformance
   facts，MISSING=0 / EXTRA=0。声明对齐不证明协议、ABI 或支付行为等价；尚未完成 App/真机验收。
7. **lint 锁定的是原版**：当前 manifest 覆盖整个已安装 npm 包的 **175 个文件（30.3 MiB）**，
   包括 framework、bridge、JS/TS、生成绑定及根目录文件。它不是安全修复，也不校验远程 widget。

> **交付状态**：§2–§3 的“重建版修改”只存在于内部候选源码；本 PR 不替换 SDK，
> 不修改 App 集成。当前被 pin 的原版二进制仍包含上述风险。任何发布结论必须另行验收。

## 1. 审计对象与方法

**iOS runtime scope**：此审计关注 `main` UI 的 Onramper client/原生 WebView；
`main`/`bg` JS heaps 分离，不能推定跨 runtime 共享 JS 实例或反序列化一次。
`HybridOnramperNitro.swift:15` 的 client 是每个 Hybrid 实例的属性；
`PreparedIntentRegistry.swift:69` 是 process-wide native singleton，Keychain 与默认
WebKit data store 也不是 JS heap 隔离资源。不能由一个 runtime 初始化推定另一个已就绪。
本轮没有验证双 runtime 并发 client 或账号隔离。

### 1.1 为什么可以高置信度审计

- 该 `.xcframework` **未被 strip**，且随包提供 **完整 dSYM**（77 个 SDK 源文件路径、
  150 个 CU / 78 个 Swift CU、约 9.6k 个子程序、行表与类型/成员信息）；
  同时提供 `.swiftinterface` 公共接口。
- 因此可以做到“声明级高保真重建 + 指令级行为验证”，而不是只做字符串扫描。

### 1.2 证据层级（关键方法论）

单看 dSYM 的 DWARF 会误判：DWARF 中出现 `UIPasteboard`、`CNContactStore` 等名字，
只是 Swift 模块**传递导入**的系统头文件声明（`decl_file` 指向 Xcode SDK 头文件），
不代表 SDK 使用。本报告采用如下层级，任一「PRESENT」必须落到前两层：

| 层级 | 证据 | 命令 |
|---|---|---|
| L1 | 链接期导入/绑定 | `xcrun llvm-objdump --macho --bind`、`dyld_info -imports`、`nm -u` |
| L2 | 指令级调用点 | `otool -tvV` + 自写注释器（selref/classref/GOT 解析） |
| L3 | ObjC 元数据 | `otool -ov`（class/method/protocol/selrefs） |
| L4 | 字符串 | `strings -a -t x`（仅旁证，可能是死代码） |

**静态未发现的判据**：L1 无对应绑定、已检查 L2/L3 无调用点或类/选择器引用；
DWARF 系统头文件命中明确排除。这不覆盖远程内容或运行时动态解析。`otool -L` 仅链接 Foundation、Combine、CoreFoundation、CoreGraphics、
CryptoKit、DeviceCheck、Security、SwiftUI、UIKit、WebKit（PassKit weak），
**没有** CoreLocation、Contacts、Photos、AVFoundation、UserNotifications、
LocalAuthentication、AdSupport、AppTrackingTransparency。

## 2. 能力判定表（iOS）

| 能力 | 判定 | 关键证据 |
|---|---|---|
| 剪贴板 Clipboard/Pasteboard | **STATIC-NOT-OBSERVED** | bind/classrefs/selrefs/`nm -u` 对 `UIPasteboard\|pasteboard\|clipboard` 全 0；4 个 JS message handler 无剪贴板动作 |
| 定位 Location | **STATIC-NOT-OBSERVED** | 无 `CLLocationManager` 绑定，未链接 CoreLocation |
| 追踪 / IDFA / ATT | **STATIC-NOT-OBSERVED** | 无 `ASIdentifierManager`/`ATTrackingManager`/AdSupport；不能据此验证服务端追踪用途 |
| 通讯录 Contacts | **STATIC-NOT-OBSERVED** | 无 `CNContact*`，未链接 Contacts |
| 相册 Photos | **STATIC-NOT-OBSERVED** | 无 `PHPhoto*`，未链接 Photos |
| 原生摄像头/麦克风 | **STATIC-NOT-OBSERVED** | 无 `AVCapture*`/`AVAudio*`，未链接 AVFoundation |
| **WebView 摄像头/麦克风** | **PRESENT-NEEDS-ACTION（重建版已修改，未集成）** | `InternalAuthWebView.Coordinator` 入口 `0x000a8ce8`、`0xa8d14` 传 `.grant`；替换源码改 deny-by-default + origin 白名单 |
| 通知 / 生物识别 | **STATIC-NOT-OBSERVED** | 无 `UNUserNotification*`/`LAContext` |
| 设备标识符 | **PRESENT-NEEDS-ACTION（重建版已降级，未集成）** | `DeviceFingerprint.collectComponents @0x7d10c`：IDFV + 机型 + 系统版本 + 屏幕 + 语言 + 时区 → SHA-256 hex → `X-Onramper-Device`；替换版移除 IDFV/屏幕/语言/时区，改安装期随机 ID |
| 遥测 Telemetry | **PRESENT-EXPECTED（默认关闭）** | `isEventLoggingEnabled` getter `ldrb w0,[x20,#0x38]`，5 个 `logEventToBackend` 调用点全部 `tbz` 门控；wrapper 默认 false → 关闭该事件端点，不代表零网络/零数据上报 |
| Keychain | **PRESENT-EXPECTED** | 服务名 `com.onramper.sdk[.appattest\|.dpop-key\|.tokens\|.oidc.]`；`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`；DPoP 私钥 Secure Enclave + `.privateKeyUsage` |
| 网络目的地 | **PRESENT-EXPECTED** | 仅 5 个硬编码 host：`api.onramper.com/headless`、`api-stg.onramper.com/headless`、`id.onramper.com`、`id.onramper.dev`、`platform.moonpay.com`；另有 `buy.onramper.com`（web widget，非 SDK） |
| WebView / JS Bridge | **PRESENT-NEEDS-ACTION（重建版已修改，未集成）** | 4 个 handler：`cbOnramp`/`MoonPayBridge`/`MoonPayConsole`/`paybisEvents`；原实现无 host 导航白名单、`defaultDataStore` 共享 Cookie；替换源码加 host 白名单 + `securityOrigin` 校验 |
| 深链 / 外部 URL | **PRESENT-NEEDS-ACTION（重建版已修改，未集成）** | 3 处 `openURL:options:`，其中 `0xa8e7c` 无校验打开新窗口 URL |
| 隐私清单 | **需复核声明（重建版已补，未集成）** | 原清单只声明 DeviceID/Email/Name/Phone，缺 SensitiveInfo/OtherFinancialInfo；替换版已补，`NSPrivacyAccessedAPITypes=[]` 仍需结合最终 App 与依赖闭包复核 |

以上是本次原生静态证据，不是对整个 SDK/远程页面的无风险证明。WebView 权限与导航、
设备指纹与隐私披露仍是原版集成的待处理项；重建源码的修改不等于生产修复。

## 3. 关键发现与重建候选源码的修改（F1–F15 摘要，未发布）

| # | 问题 | 修复（重建源码） |
|---|---|---|
| F1 | 登录 WebView 无条件授予摄像头/麦克风 | `requestMediaCapturePermission` 改 `.deny` 默认；仅精确 OnramperID 主机且 `type == .camera` 允许 `.prompt`，麦克风始终 deny，永不 `.grant` |
| F2 | 登录 WebView 新窗口 URL 无校验 | 仅 https + `{id.onramper.com,id.onramper.dev}`；否则忽略并记录 |
| F3 | checkout 导航用 URL 子串判断 | 改 scheme+host 精确白名单（不做子域后缀匹配）；非白名单 top-frame 与 subframe → cancel/blocked |
| F4 | provider WebView 无导航策略 / JS 消息不校验来源 | Paybis/MoonPay/Coinbase 加精确 host 导航白名单 + `securityOrigin.host` 必须等于 trusted frame host（不做子域回退） |
| F5 | Paybis 全局 monkey-patch `window.postMessage` | 改 `message` 事件 + `event.origin` 过滤 |
| F6 | 设备指纹含 IDFV/屏幕/语言/时区 | 安装期随机 ID + 机型 + OS 主版本 + SDK 版本 |
| F7 | 遥测 body 可能携带 PII | 固定 4 字段（checkoutId/eventType/providerEventName/metadata）+ PII 断言 |
| F8 | 日志可能泄漏 token/PII | 默认关闭、生产不注册 systemHandler、值全量脱敏 |
| F9 | pinning 仅覆盖安全端点 | 保持 fail-closed/SPKI-SHA256；主 BFF pinning 放在内部开关后（默认关，避免直接断网） |
| F10 | `pinnedSession` 复用 | 保留安全端点 pinned session，BFF 扩展走显式开关 |
| F11 | Keychain 清理不完整 | `signOut`/`reset` 清理全部 service（含 legacy namespace） |
| F12 | 隐私清单漏报 | 已补 `NSPrivacyCollectedDataTypeSensitiveInfo` / `OtherFinancialInfo` |
| F13 | 新增 public `enableWebViewCamera` | **不实施**（会破坏 public API parity）；改用内部常量，默认 deny |
| F14 | 上游二进制带 `__llvm_prf_*` 插桩 | 重建源码不继承（上游产物问题） |
| F15 | UI 合约未写明 WebView 安全约束 | 合约与 `ProviderNavigationPolicy` 已固化 |

> **验收整改记录（2026-11-06）**：独立验收发现 F1–F4 仍偏宽，已收紧为「精确 host + camera-only prompt + 非主框架默认拒绝 + 消息 origin 精确等于 trusted host」。F7/F10/F11 仍为部分实现（EventLogRequest 为黑名单过滤、无统一 `pinnedSession(host:pins:)` 方法、`reset()` 未清 Keychain），详见内部安全报告附录 D；不要把 F1–F15 视为全部完成。

## 4. 反编译与重建结果

### 4.1 拆分结果（按原始源码结构）

- 从 dSYM compile unit 提取的权威源文件清单：**77 个**
  `Sources/OnramperSDK/**/*.swift`（另有 1 个 DerivedSources 的
  `resource_bundle_accessor.swift`）。
- 可读重建源码：**78 个 Swift 文件**（58 个核心模块 + 19 个 UI/WebView 源文件 +
  1 个共享策略文件），每个文件带机器提取的证据头（DWARF 函数名/decl_line/入口
  PC、Swift 反射的存储属性顺序/枚举 case），推断处标记
  `// RECONSTRUCTION: inferred`。
- 可编译替换源码：**79 个 Swift 文件**（58 核心 + 21 Views/辅助），
  模块名保持 `OnramperSDK`，公共 API 与原始 `.swiftinterface` 一一对应。

覆盖模块：`Auth`（OIDC/PKCE/Prefill/SessionReauth）、`Checkout`
（CheckoutManager/ToS/AmountLimit/UserInfo/ProviderBootstrap）、`Crypto`
（X25519+AES-GCM 临时密钥交换）、`Diagnostics`（脱敏日志/遥测）、`Errors`、
`Events`、`Models`（Codable 1:1）、`Networking`（BFF/SecurityEndpoints）、
`Security`（App Attest/DPoP/JOSE/Keychain/证书固定/设备指纹）、`State`
（状态机/状态枚举）、`Views`（SwiftUI 按钮、checkout 宿主、WKWebView renderer、
MoonPay/Paybis/Coinbase provider 桥）。

### 4.2 内部交付物记录的验证结果

本轮独立重跑了 `compare-interface.py --strict`（device interface）并确认 360/142、无差异。
下表其他构建/探针/集成结果来自既有交付记录；本轮没有重跑会写入内部目录的脚本。
`verify.sh` 中部分检查只验证存在性或静态关键词，12/12 不能代替支付与安全行为测试。

| 门禁 | 结果 |
|---|---|
| `build/build-ios.sh --clean`（device arm64 + simulator arm64/x86_64） | **GREEN**（79 源文件，3 slice，产出 `OnramperSDK.xcframework`，无 stub） |
| 公共接口严格门禁（原版 vs 重建） | **360 declarations / 142 conformance facts，MISSING=0 / EXTRA=0** |
| 独立 canonicalized 声明对比 | **252 vs 252 declarations，一致** |
| 包装层用法 API 探针（先对**原版** framework 编译通过，再对重建产物 `-F` 导入） | **PASS**（device + simulator） |
| 独立 `verify/verify.sh` | **12/12 PASS**（77/77 源文件覆盖、无敏感 API、遥测默认关闭、podspec、构建、接口、二进制 bind 表扫描、探针） |
| 重建产物 bind 表隐私扫描 | **PASS**：无剪贴板/定位/ATT/通讯录/相册/摄像头麦克风/生物识别 |
| `integration/apply.sh` / `restore.sh`（`--skip-pod-install`） | **PASS**：podspec + Podfile 修改后可**逐字节还原** |

> 未执行：完整 `pod install` + App 构建（需完整 RN 工具链/CI）、真机端到端
> Apple Pay 购买、Onramper 后端对新 device_id 的兼容性确认。见 §9。

### 4.3 已知局限

可编译、可链接、公共 API 已对齐，但**服务端协议行为**属于证据推断（已逐项风险
标注，内部交付物 `RECONSTRUCTION-GAPS.md` G1–G22）：BFF 请求/响应 schema 细节、
App Attest bootstrap 具体时序、X25519/AES-GCM KDF 细节、pin→host 映射、
OIDC 具体路径、provider bootstrap 策略、错误文案等。**上线前必须真机全流程冒烟**。

## 5. Android 审计结论（远程 web widget + WebView）

### 5.1 平台、运行时与原生对象

- Android 的 `main`/`bg` 是独立 JS heaps，初始化顺序不保证。URL 由 `bg` 的
  `ServiceFiatCrypto.ts:170` 请求 `/wallet/v1/fiat-pay/url`，页面在 `main` 打开。
  页面 JS 在 WebView 的独立上下文；Cookie/网页存储属于原生 WebView profile，不能假设
  随 modal 关闭或钱包切换清除。本次未证明账号隔离；也不能把 main/bg 中的 JS 对象视为共享。
- `canUseHeadless.native.ts:17` 对 Android 返回 false，`index.native.ts` 的 real-client
  只允许真实 iOS 设备。已安装 `@onramper/onramper-react-native@1.3.1` 无 `android/`
  或 AAR/JAR/SO；Yarn 缓存的同版本 zip 也无 Android 原生产物。
- 2026-11-06 本轮只读检查：本 worktree 与主 checkout 的 Android Gradle/Maven 配置
  无 Onramper 引用；`~/.gradle` 的 7,945 个 AAR/JAR、`~/.m2` 的 2 个、主
  `node_modules` 的 75 个 archive（含 AAR 内的 `classes.jar`）未发现 Onramper entry；
  Yarn 两类缓存及 npm cache index 未发现额外 Android Onramper 包。
  另查 Downloads/Desktop/Documents/CocoaPods cache、`/Applications`、`/Library` 的
  Android artifact 路径名亦无命中；`/Library` 有 11 个目录不可读。
  这是指定目录/文件名/归档 entry 的负面证据，不是对改名、混淆或未检查磁盘的全机证明。
- 实际 URL 是后端返回值；本轮没有调用需要身份的接口。因此 `buy.onramper.com` 是所审计
  的候选 widget，不能断言当前用户收到的 URL、参数及 swap/OID 功能开关与捕获页一致。

### 5.2 捕获资产复核与原报告更正

- `widget/SHA256SUMS.txt` 的 **1,649 项全部离线复算匹配**；source-map 重建文件为
  **1,583 个**。这只确认内部快照自洽，不证明来源可信或未来线上字节相同。
- prod/dev raw JS 未找到 geolocation、getUserMedia/mediaDevices、Permissions API；
  clipboard read 位于 Web3Modal paste UI，write 位于 Web3Modal 与 swap transaction UI。
  `WalletConnectConditionalWrapper.tsx:14` 的条件是 `supportSwap`，不能由“入口叫买币”
  推断 swap 永不可达。付款供应商 iframe、OID iframe、AWS challenge.js 不包含在此负面结论中。
- 指纹在 `deviceFingerprint.ts:10–88` 采集 screen/timezone/language/platform/cores/
  memory/touch/canvas/WebGL，经 **DJB2** 派生后以 `deviceFingerprint` 发往 intent/resume。
  发出的是派生值；此证据不表示每项原始属性分别发送，也不应将其视为强设备认证凭据。
- 确认 uuid 4 年 cookie、localStorage/sessionStorage/IndexedDB/OID token 存储。
  PostHog 已初始化，捕获 build 关闭自动与自定义 event capture；不能据此声称完全没有
  PostHog 请求、remote flags 或 session recording。AWS WAF、Fonts 与 cookie iframe
  是代码中的加载路径，离线分析没有观测它们在用户设备上的实际网络行为。
- **原 SCAN.md 的 listener 数量/覆盖不完整**：除 theme、OID callback 外，
  `useThirdPartyCookieCheck.ts:14–24` 也接收 window message，未校验 origin/source，
  影响 `is3PCBlockedOnramp` 的渠道可用性判断。theme handler 同样未校验来源，且将消息字段
  拼入 CSS 文本，不能未经验证限定为“仅颜色变化”；OID `protocol.ts:94–120` 校验
  origin/source/state/iss 的结论成立。未执行消息攻击或证明凭据泄露。
- 原报告“无商业 tracker SDK”应改为“PostHog 存在，捕获版本 event capture 关闭”；
  “widget 不收集 KYC”应限定为所见 UI：`useCheckoutIntent.ts:124–194` 仍处理
  kycToken/email/KYC share token。原 `SCAN.md` 所谓所有指纹读取均包在 try/catch
  也不准确，只有 canvas/WebGL 和存储访问有对应 catch。
- `FINDINGS.md` 实际路径是 `onramper-sdk/artifacts/android/FINDINGS.md`，不是
  `widget/FINDINGS.md`。内部报告按任务要求保持只读；本节是其更正说明。

### 5.3 OneKey 原生边界与建议

- `openUrlUtils.ts:474` 的 fiat modal 没传 `disableBridge`；
  `InpageProviderWebView.native.ts:123` 会注入 `$onekey` provider。这增加远程页面接触
  钱包 RPC 的面，但不等于绕过 origin、连接授权、解锁或签名确认；本轮没有证明这些校验失效。
  建议单独评审 fiat 路由禁用 bridge，并验收购买/跳转流程。
- `WebViewModal/index.tsx:544` 传 `fiatPaySiteWhitelist`，默认 `[]`；Android patched
  `RNCWebChromeClient.java:214` 对不在名单的 camera/audio request 不授予对应 resource，
  在名单内仍需 OS 权限。若调用者省略该 prop，则使用上游权限逻辑，不能推广为所有 WebView 默认 deny。
- `RNCWebViewManagerImpl.kt:92–96` 默认禁用 file/content access 与 mixed content。
  App Manifest 移除普通定位声明，但通过 `uses-permission-sdk-23` 将粗/精确定位保留至
  API 30；API 31+ 无这些声明。RECORD_AUDIO 和广泛媒体读权限被移除，CAMERA 保留。
  OID iframe 的 `allow="camera; microphone"` 不能绕过上述宿主/OS 权限。
  本轮未重建 merged Release Manifest，也未做真机 KYC 权限验收。
- `cacheEnabled={false}` 不清 Cookie/DOM storage，也不校验远程资源。跨域导航重定向
  Discovery 不等同于 URL allowlist；需另行验收后端 URL、provider frame 与账号隔离。

### 5.4 哪些字节能 pin

当前没有本地 Android Onramper native SDK 可加入 manifest。已 pin 的 npm 包含跨平台
wrapper 源码，但 Android 实际执行的 widget 来自服务器；pin 审计快照只能保护证据，
不能保护用户加载的网页。若未来经供应商许可自托管/随包发布固定 widget，再把 HTML、JS、
动态 chunks、worker、source map 对照与外部脚本依赖一起纳入受控发布及完整性策略。
当前应监控线上变更、减少 bridge 与权限、限制 URL，而不是在 CI 下载最新页面并自动更新 hash。

## 6. 候选替换方案（本 PR 未实施）

```bash
# 1) 构建替换 framework（无需 Xcode 工程）
onramper-sdk/build/build-ios.sh --clean

# 2) 用 source pod 替换 vendored 二进制
yarn
onramper-sdk/integration/apply.sh    # patch podspec + Podfile + pod install
onramper-sdk/integration/restore.sh  # 如需回退
```

- 模块名保持 `OnramperSDK`，开源包装层（`@onramper/onramper-react-native`）
  除 podspec 外无需改动。
- 重建产物包含与原始相同的 `Modules/OnramperSDK.swiftmodule/<triple>.swiftinterface`、
  `Info.plist`、`PrivacyInfo.xcprivacy` 布局。

## 7. 外部 SDK 完整性 lint（本 PR 新增）

**目的**：对以二进制分发、无法在本仓库 review 源码的三方 SDK 做供应链完整性校验。
首个接入对象就是 Onramper iOS SDK（已形成内部反编译静态审计交付物，
本目录 `OnramperSDK.md` 即该审计结论；lint 用于防止审计过的字节被替换）。

**实现**（`development/lint/external-sdk.js` + `external-sdk.config.json`）：

- manifest 按 **175 个文件（30.3 MiB）** 记录每个文件的 SHA-256 + size，覆盖该 npm 包的全部分发文件：
  `ios/`（xcframework 全量 + podspec 编译的所有 Swift/ObjC 源文件）、`lib/`（RN 实际加载的 JS 产物）、
  `src/`（Metro 源码入口）、`nitrogen/`（生成的原生绑定）、`OnramperReactNative.podspec`、
  `app.plugin.js`、`nitro.json`、`package.json`、`LICENSE`、`NOTICE`、README/CHANGELOG；
  `directories: ["."]` 同时检测新增的根目录 build/autolink 配置。只忽略普通 `.DS_Store` 文件；
- 同时 pin npm 包版本（`1.3.1`）；
- 校验规则：
  - 文件内容变化 → `MODIFIED`，失败；
  - 新增文件（如注入的 `.dylib`/插件）→ `UNEXPECTED`，失败；
  - 文件缺失 → `MISSING`，失败；
  - 包版本变化 → 失败；
  - 从显式 base 至 SDK root、目录、文件逐级拒绝 symlink；路径必须为规范 POSIX/NFC，拒绝 case collision；
  - hash 用同一 fd 读取并核对前后 inode/size/mtime/ctime 与读取字节数，检测常见读取期间变化；
    `O_NOFOLLOW`/`O_NONBLOCK` 仅在平台提供时使用；Windows 缺失这两个 POSIX 常量时，
    依赖逐级 lstat 与 fd/路径 metadata 比对拒绝 symlink，不再直接失败；
  - manifest 的 SHA-256/size 与版本文件覆盖须有效；`--write` 拒绝版本漂移/空选择，全部成功后原子替换配置。
- 命令：
  - `yarn lint:external-sdk`（CI / `lint:project` / `agent:check` 已接入）；
  - `node development/lint/external-sdk.js --write`（评审后重新 pin，必须 review diff）；
  - `--json` 机器可读输出。
- 测试：`development/lint/external-sdk.node-test.js` 覆盖内容/文件集合漂移、版本漂移、
  leaf/ancestor symlink、路径/摘要 schema、版本文件覆盖、write 幂等/失败保留配置、
  short read 与读取期间 metadata 变化、平台缺少 POSIX open 常量（Windows）时的 open 策略
  与 symlink 拒绝，共 27 个测试；CI 的 `01-lint` workflow 执行该测试。
- **工作区限制**：本 worktree 的 `node_modules` 是 symlink，因此默认命令有意拒绝。
  可用 `yarn lint:external-sdk --base /Volumes/T7Shield/Project/app-monorepo` 显式检查真实
  安装根；默认 config 仍是本 worktree 的 manifest。CI 的普通实体目录不需此参数。
- **信任边界**：manifest/checker/CI 本身必须人工评审；攻击者同时修改它们可改变信任基准。
  检查不是安装脚本 sandbox，也不阻止检查之后的替换，更不能对恶意并发目录交换提供原子快照保证。
  应在隔离、无并发安装的 CI 中执行，并在消费产物的 build 阶段建立同等门禁；当前 wiring 仅 lint job。
  本轮验证 macOS；Linux workflow wiring（包括 dependency snapshot 使用 mount 而非 symlink）
  已检查，但本轮没有新 Linux runner 执行结果。Windows 路径由“模拟缺失 O_NOFOLLOW/O_NONBLOCK”
  的回归测试覆盖，本轮没有真实 Windows runner 执行结果。175 个 pin 均与 Yarn 缓存 1.3.1 zip 一致，
  原有 173 个 pin 未改变，只增加 README/CHANGELOG 两个摘要。
- 扩展方式：在 `external-sdk.config.json` 的 `sdks[]` 追加条目即可接入下一个
  二进制 SDK（Android AAR、其他 xcframework 等）。

## 8. 合规与许可（需法务确认）

- 厂商随包提供 `LICENSE` + `NOTICE`，NOTICE 明确：
  **“This product is licensed under the Apache License, Version 2.0.”**
  npm 包 `license` 字段亦为 Apache-2.0。这是许可标注的证据，并非本审计作出的
  逆向/衍生发行法律结论；应由法务确认授权范围、依赖与协议。若按该许可分发，需核对：
  1. 随分发物附 Apache-2.0 LICENSE 全文；
  2. 保留版权/NOTICE 归属声明；
  3. 明确标注修改（“Modified/reconstructed by OneKey”）；
  4. 不使用 Onramper 商标暗示官方背书（§6 不授予商标权）。
- **服务/API 是另一回事**：Apache-2.0 不授权 Onramper 后端服务；替换 SDK 仍调用
  `api.onramper.com/headless` 等，受合作伙伴协议/API ToS 约束；需与 Onramper
  书面确认（是否允许自建客户端、替换 SDK）。后端 App Attest/DPoP 校验也可能
  只接受官方客户端。
- 本次内部交付物包含反编译衍生源码；是否随公开发行需法务评估。本 PR 仅提交
  lint + 本文档，不含重建源码。

## 9. 上线前必须完成

1. 在有完整 RN 工具链的机器/CI 上执行 `integration/apply.sh` → `pod install` →
   App 构建。
2. 真机走通「登录 → ToS → Apple Pay → finalize → completed」全流程；保留
   web-widget 回退开关。
3. 与 Onramper 后端确认新 `device_id` / `X-Onramper-Device` 兼容（否则可能
   `deviceBlocked`）。
4. 按 §3 的 F1–F5 补单元测试（非法 origin/host → deny/cancel；合法域 → allow），
   并在 App Store 归档时核对隐私清单与 App Privacy 答案一致。
5. 审阅内部交付物 `RECONSTRUCTION-GAPS.md` 中 G1–G22，逐项决定
   “接受推断 / 补测试 / 补协议文档”。

## 10. 内部交付物索引（未随本 PR 提交）

| 内容 | 位置 |
|---|---|
| 可读反编译源码（78 文件，带证据头） | `onramper-sdk/decompiled-ios/` |
| 可编译替换源码（79 文件） | `onramper-sdk/ios-src/OnramperSDK/` |
| 构建/接口对比/探针 | `onramper-sdk/build/` |
| 独立验证（12/12） | `onramper-sdk/verify/` |
| 替换集成脚本 | `onramper-sdk/integration/` |
| 完整安全审计 + Android 分析 | `onramper-sdk/report/` |
| iOS 二进制证据（39 MB，可复现） | `onramper-sdk/artifacts/ios/` |
| Android widget 抓取/还原/扫描 | `onramper-sdk/artifacts/android/` |

> 证据复现：`artifacts/ios/tools/run-all.sh`（约 5 秒重建全部 iOS 二进制证据）。
> 内部目录位于开发 worktree，不属于本 PR 的提交范围。

---

_本文档位置：`development/lint/external-sdk-audit-docs/OnramperSDK.md`（与
`external-sdk.js` / `external-sdk.config.json` 同级）。以后每个接入 `external-sdk`
lint 的三方 SDK 都在此目录下建一个同名 Markdown 文档。_


## 11. 其他 SDK 的审计与 pin 候选（本轮仅盘点，未新增 manifest 条目）

版本来自当前 package/Pod lock、分发文件与 cache；cache 中有版本不等于当前 Release
已链接该版本。下面按资金/代码执行/隐私风险排序；许可证是随包标注，不代替法律审查。
`NM` = `node_modules/`，`Pods` = `apps/mobile/ios/Pods/`（本 worktree 未安装 Pods，
相应实物读取自主 checkout）。不 pin `.cxx`/build 等本地产物。

| 优先级 / 候选 | 路径与版本 | source / distribution / local patch | 建议门禁与审计文档 |
|---|---|---|---|
| 高：Juicebox，涉及 keyless secret share | `NM/@phantom/react-native-juicebox-sdk/android/libs/juicebox-sdk.aar`（RN 0.3.17，内含 4 ABI SO）；`Pods/JuiceboxSdk/artifacts/ffi/*/libjuicebox_sdk_ffi.a`（Pod 0.3.2） | RN/core MIT；[上游含 Rust/Swift/Android source](https://github.com/juicebox-systems/juicebox-sdk)，但本地 prebuilt 与 source commit 的对应未核验。Podfile 有 SSH→HTTPS 与 FFI link 修改，未见该 RN 包 patch | 优先审计 PIN/secret、网络和生命周期；核对 artifacts submodule/构建 provenance 后 pin AAR、FFI 和 wrapper。iOS 在 pod install 后单独校验 |
| 高：bundle-crypto / Gopenpgp，涉及 OTA 签名信任 | `NM/@onekeyfe/react-native-bundle-crypto/ios/Frameworks/Gopenpgp.xcframework`，6.7.0-alpha.422 | OneKey MIT，Gopenpgp MIT/Go mobile BSD notices；LICENSE 明确只有 Catalyst slice 记录 v3.4.1，其余 slice 来源与依赖闭包未核验。podspec 重建 Catalyst framework symlink | 单独 provenance/security doc；先确定每个 slice 来源，再 pin 分发文件/归档。当前 lint 拒绝 symlink，不能直接对 pod install 后整树加条目 |
| 高：Intercom，用户会话/附件/音视频 | `Pods/Intercom/Intercom.xcframework` 19.9.1；Gradle `io.intercom.android:intercom-sdk:18.10.0`；RN 10.8.1 | RN MIT；本地 iOS LICENSE 标 Apache-2.0/TinyConstraints MIT，但[发布仓库以 xcframework 分发](https://github.com/intercom/intercom-ios)，SDK 实现源码不可直接审计。`apps/mobile/scripts/patch-intercom-ios.py/.json` 修改二进制并已有 input/output SHA-256；Android 有 build-logic 隐私改写 | 保留现有 fail-closed patch 门禁，补独立安全 doc、验证最终输出/签名；若统一 lint，采用 iOS post-pod 阶段与 Android artifact checksum，不直接塞入无 Pods 的 Linux job |
| 高：JPush / JCore，标识/后台通信 | `NM/jpush-react-native/{ios,android}`：RN 3.2.1、iOS/Android 5.9.0；`NM/jcore-react-native/{ios,android}`：RN 2.3.2、iOS 5.2.1 / Android 5.2.0 | wrapper ISC 不代表原生 source 可得；xcframework/static lib/JAR 随 Git pin fork 分发。Android `build-logic/privacy-security-plugins` 有字节码改写 | 原版分发物适合确定 hash；还需验证改写后的 APK/AAB 和 variant，独立 doc 记录隐私功能与残余远程面 |
| 高：Lite Card / keychain / bundle loaders 等 Nitro | `NM/@onekeyfe/react-native-{lite-card,keychain-module,bundle-update,split-bundle-loader}`，6.7.0-alpha.422；Nitro 0.37.0 | OneKey MIT 原生 source 在包内及 app-modules；Lite Card 的 `sdk/` 有 C/C++，不是当前版本只能拿到闭源二进制。Nitro 有 `patches/react-native-nitro-modules+0.37.0.patch` | 先 source audit（密钥/OTA/跨 runtime 所有权），source→npm provenance；必要时 pin 发布源文件。不要 pin 本地生成的 `libgpchannel_core.a`；`lint:onekeyfe-patches` 管 patch 范围，不是完整性门禁 |
| 高：MMKV，持久化秘密与一致性 | `apps/mobile/native/mmkv/source.lock.json`、`checked-sync.patch`；RN 4.3.2 / Core 2.4.0、Android baseline 2.4.1、commit `4007cba6…` | MIT/BSD source；`prepare-mmkv-source.js` 已验证 archive SHA-256、patch receipt、patched tree SHA-256，并检查生成 header；两平台 source build | 应有存储/并发审计文档并验证现有门禁执行；无需重复 pin 非确定性编译输出 |
| 中高：RN WebView / WalletConnect / Reown | `NM/react-native-webview` 13.16.1；`NM/@walletconnect/*` 2.23.10（ethereum-provider 2.21.5）；Reown RN 1.3.1 / web 1.8.9 | WebView MIT，有权限 patch；WC/Reown JS/TS source 可读，未发现独立 WalletConnect native AAR/xcframework。旧包 Apache/MIT，当前 core/sign-client LICENSE 是 WalletConnect Community License；Reown 多个 patch，RN ethers5 使用固定 app-modules commit | source/bridge/授权审计优先；pin wrapper 不能固定 relay、配置或远程 iframe。需独立 doc 区分本地代码、RN native 依赖与远程服务 |
| 中：Sentry | `NM/@sentry/react-native` 8.2.0、Pod 9.5.1、Android 8.33.0；`android/libs/replay-stubs.jar` | SDK MIT source 可读；有 RN/browser patch。replay-stubs 是本地 JAR；工具链还有 CLI prebuilt，不能混作 App SDK | 审计脱敏、采集开关/上传链路；pin 已发布 JAR/CLI 或构建下载校验。CocoaPods/Maven 使用独立平台门禁 |
| 中：RevenueCat / Google native deps | RN purchases 10.4.3、Pod 5.80.3；cache purchases 10.13.0 / Billing 8.3.0 / Block Store 16.4.0 / Ads ID 17.0.1；expo-camera 声明 ML Kit barcode 17.3.0 | RevenueCat wrapper/core MIT source 可得；Google 执行组件 AAR/服务部分未取得可直接审计 source，Google 条款。未见 purchases patch；Expo 有本地修改 | 分开审计 wrapper 与闭源执行层；先核对 Release resolved graph/merged Manifest，再 pin Maven artifacts，不以 cache 版本代替 Release 证明 |
| 中低：Notifee / Realm / Skia / Expo prebuilts | `NM/@notifee/react-native/android/libs/app/notifee/core/202108261754/*.aar`（RN 9.1.8）；Realm 20.2.0 podspec 指向 `prebuilds/apple/realm-core.xcframework`；Skia 2.14.0 `libs/` 与 platform packages；Expo 58 `local-maven-repo/` | Notifee wrapper Apache-2.0，core AAR 对应 source 未核验；Realm Apache-2.0、Skia MIT/BSD、Expo MIT source 可得，但 source/source JAR 不证明所有 prebuilt 同源。Skia podspec 会复制平台产物；本地 build/.cxx 需排除 | 分发 artifact 可 pin，先核实来源/平台布局/patch 后时点；优先 Realm 数据存储，再媒体解析。避免把 copy/build 后树直接当跨平台固定 manifest |

以上候选未做新的可重复下载/全平台 hash 验收，因此本轮未给它们新增 pins。
Remote Intercom、Stripe.js、TradingView/Turnstile 等也需独立 source/供应链评估；本地 loader
hash 不覆盖远程返回代码。它们应与 Android Onramper widget 一样记录版本快照和运行时边界。
