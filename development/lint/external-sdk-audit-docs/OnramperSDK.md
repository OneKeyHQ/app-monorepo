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
> **审计覆盖范围**：iOS 原生二进制（完整审计）+ Android 实际接入面（无原生 SDK，
> 审计远程 web widget 与 WebView/Manifest 配置）。详见 §5。

## 0. 结论速览

1. **用户最担心的行为不存在**：剪贴板读写、定位、IDFA/ATT 跨 App 追踪、通讯录、
   相册、原生摄像头/麦克风，在 iOS v6.0 二进制中经「链接期导入 → ObjC 类引用 →
   指令级调用点 → ObjC 方法」四层验证均为 **PROVEN-ABSENT**。
2. **发现 1 个真实高危项并已在重建源码中修复**：OIDC 登录 WebView
   （`InternalAuthWebView`）对 `requestMediaCapturePermission` **无条件返回
   `.grant`**（`0x000a8ce8`），任意来源可静默获得摄像头预授权；同一 WebView 的
   新窗口 URL 无校验即 `UIApplication.openURL`；checkout 导航仅用 URL 子串
   （`success/complete/thank/failure/error/cancel`）识别终态页，任意域名可伪造。
3. **设备标识符确实被采集**：机型 + 系统版本 + 屏幕 + `identifierForVendor` +
   语言 + 时区 → SHA-256 → `X-Onramper-Device` 随每个 BFF 请求上报；属设备识别，
   非跨 App 追踪（`NSPrivacyTracking=false` 与实际相符）。
4. **正面结论**：证书固定 **fail-closed** 且为 **SPKI-SHA256**（失败即
   `cancelAuthenticationChallenge`），但仅覆盖安全端点专用 session，主 BFF /
   provider WebView 未固定；遥测（`POST v1/checkout/events`）被
   `isEventLoggingEnabled` 完全门控，OneKey 默认传 `false` → **零上报**；
   Keychain 均为 `ThisDeviceOnly`，DPoP 私钥在 Secure Enclave。
5. **Android 上没有可反编译的原生 SDK**：本仓库/本机/公共渠道均不存在 Android
   原生 Onramper SDK（详见 §5）。Android 实际暴露面是 Onramper 托管网页 widget。
6. **可以替换**：重建出同模块名 `OnramperSDK` 的可编译 Swift 源码，公共 API 与
   原版 1:1（严格门禁 360 declarations / 142 conformance facts，MISSING=0 /
   EXTRA=0），device + simulator 构建通过，包装层用法探针通过。
7. **本 PR 新增外部 SDK 完整性 lint**：对 `OnramperSDK.xcframework` + Swift bridge
   共 30 个文件做逐文件 SHA-256 pin（30.0 MB），任何文件被修改/新增/删除、
   或 npm 包版本变化都会让 CI 失败（§7）。

## 1. 审计对象与方法

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

**ABSENT 的判据**：L1 无绑定、L2 无调用点、L3 无类/选择器引用；DWARF 系统头文件
命中明确排除。`otool -L` 仅链接 Foundation、Combine、CoreFoundation、CoreGraphics、
CryptoKit、DeviceCheck、Security、SwiftUI、UIKit、WebKit（PassKit weak），
**没有** CoreLocation、Contacts、Photos、AVFoundation、UserNotifications、
LocalAuthentication、AdSupport、AppTrackingTransparency。

## 2. 能力判定表（iOS）

| 能力 | 判定 | 关键证据 |
|---|---|---|
| 剪贴板 Clipboard/Pasteboard | **PROVEN-ABSENT** | bind/classrefs/selrefs/`nm -u` 对 `UIPasteboard\|pasteboard\|clipboard` 全 0；4 个 JS message handler 无剪贴板动作 |
| 定位 Location | **PROVEN-ABSENT** | 无 `CLLocationManager` 绑定，未链接 CoreLocation |
| 追踪 / IDFA / ATT | **PROVEN-ABSENT** | 无 `ASIdentifierManager`/`ATTrackingManager`/AdSupport；`NSPrivacyTracking=false` 相符 |
| 通讯录 Contacts | **PROVEN-ABSENT** | 无 `CNContact*`，未链接 Contacts |
| 相册 Photos | **PROVEN-ABSENT** | 无 `PHPhoto*`，未链接 Photos |
| 原生摄像头/麦克风 | **PROVEN-ABSENT** | 无 `AVCapture*`/`AVAudio*`，未链接 AVFoundation |
| **WebView 摄像头/麦克风** | **PRESENT-NEEDS-ACTION → 已修复** | `InternalAuthWebView.Coordinator` 在 `0x000a8ce8` 无条件 `.grant`；替换源码改 deny-by-default + origin 白名单 |
| 通知 / 生物识别 | **PROVEN-ABSENT** | 无 `UNUserNotification*`/`LAContext` |
| 设备标识符 | **PRESENT-NEEDS-ACTION → 已降级** | `DeviceFingerprint.collectComponents @0x7d10c`：IDFV + 机型 + 系统版本 + 屏幕 + 语言 + 时区 → SHA-256 hex → `X-Onramper-Device`；替换版移除 IDFV/屏幕/语言/时区，改安装期随机 ID |
| 遥测 Telemetry | **PRESENT-EXPECTED（默认关闭）** | `isEventLoggingEnabled` getter `ldrb w0,[x20,#0x38]`，5 个 `logEventToBackend` 调用点全部 `tbz` 门控；OneKey 传 false → 零上报 |
| Keychain | **PRESENT-EXPECTED** | 服务名 `com.onramper.sdk[.appattest\|.dpop-key\|.tokens\|.oidc.]`；`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`；DPoP 私钥 Secure Enclave + `.privateKeyUsage` |
| 网络目的地 | **PRESENT-EXPECTED** | 仅 5 个硬编码 host：`api.onramper.com/headless`、`api-stg.onramper.com/headless`、`id.onramper.com`、`id.onramper.dev`、`platform.moonpay.com`；另有 `buy.onramper.com`（web widget，非 SDK） |
| WebView / JS Bridge | **PRESENT-NEEDS-ACTION → 已修复** | 4 个 handler：`cbOnramp`/`MoonPayBridge`/`MoonPayConsole`/`paybisEvents`；原实现无 host 导航白名单、`defaultDataStore` 共享 Cookie；替换源码加 host 白名单 + `securityOrigin` 校验 |
| 深链 / 外部 URL | **PRESENT-NEEDS-ACTION（低）→ 已修复** | 3 处 `openURL:options:`，其中 `0xa8e7c` 无校验打开新窗口 URL |
| 隐私清单 | **UNDER-DECLARED → 已补** | 原清单只声明 DeviceID/Email/Name/Phone，缺 SensitiveInfo/OtherFinancialInfo；替换版已补，`NSPrivacyAccessedAPITypes=[]` 判定为准确（无 NSUserDefaults/文件时间戳等） |

**底线**：静默读剪贴板 / 定位外传 / 通讯录相册 / 广告追踪 **不存在**；需要处理的是
WebView 权限与导航、设备指纹最小化、隐私清单补齐——均已在重建源码中落地。

## 3. 关键发现与修复（F1–F15 摘要）

| # | 问题 | 修复（重建源码） |
|---|---|---|
| F1 | 登录 WebView 无条件授予摄像头/麦克风 | `requestMediaCapturePermission` 改 `.deny` 默认；仅 OnramperID 域允许 `.prompt`，永不 `.grant` |
| F2 | 登录 WebView 新窗口 URL 无校验 | 仅 https + `{id.onramper.com,id.onramper.dev}`；否则忽略并记录 |
| F3 | checkout 导航用 URL 子串判断 | 改 scheme+host 精确白名单；未知 top-frame → cancel 并关闭 |
| F4 | provider WebView 无导航策略 / JS 消息不校验来源 | Paybis/MoonPay/Coinbase 加 host 白名单 + `securityOrigin.host` 校验 |
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

### 4.2 验证结果（可复现）

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

## 5. Android 审计结论（无原生 SDK；审计远程 web widget + WebView 配置）

- **本仓库没有 Android 原生 Onramper SDK**：`@onramper/onramper-react-native`
  仅 iOS（1.3.1 与最新 1.6.0 均如此）；`apps/mobile/android` 无任何 Onramper
  gradle/maven 依赖；`~/.gradle`、`~/.m2`、Yarn/npm/CocoaPods 缓存、`/Applications`、
  `/Library` 均无 AAR/JAR/so；Maven Central 0 结果、Google Maven/JitPack 404、
  GitHub 无 `onramper-android` 仓库。
- Android 实际链路：`canUseHeadless()` 在 Android 恒为 false → 由 OneKey 后端
  `GET /wallet/v1/fiat-pay/url` 返回 URL → React Native WebView 打开
  `https://buy.onramper.com` 远程 widget。
- 已抓取线上 widget 并利用其**公开 source map** 还原 **1,583 个 JS 源文件**审计：
  - 买单流程：**无** geolocation / getUserMedia / Permissions API / 剪贴板读取；
    剪贴板写入仅见于“复制充值地址”，读取仅见于 WalletConnect/Web3Modal 的
    “粘贴地址”组件（不在买币主流程）。
  - 存在：浏览器指纹（screen/timezone/language/platform/cores/deviceMemory/
    touch/2D canvas/WebGL）、4 年期 uuid cookie、localStorage/sessionStorage/
    IndexedDB、PostHog（capture 关闭）、AWS WAF `challenge.js`、Google Fonts；
    无 GA/GTM/Segment/Sentry/Hotjar/FB。
  - 风险点：远程代码随时可变且 App 不做完整性校验；App 在该页面**未禁用
    `$onekey` JSBridge 注入**（widget 自身未使用，但页面一旦被 XSS/供应链污染
    即可触达注入的 bridge）。这是 Android 侧最值得收紧的信任边界。
- 结论：Android **不存在“可反编译替换”的原生对象**；若要去掉闭源 widget，
  需基于 Onramper 公开 API 自建页面或更换供应商（产品决策）。

### 5.1 Android 审计边界

- **可离线证明**：仓库无 Android 原生产物、Manifest 权限、WebView 配置、
  widget 抓取版本的 JS 行为（source map 还原）。
- **不可离线证明**：线上 widget 由 Onramper 服务端随时更新；本次结论仅对
  2026-11-06 抓取版本（SHA-256 已记录）负责，App 不做完整性校验。
- **不适用**：Android 没有可 pin 的本地 SDK 二进制，因此 `external-sdk` lint
  当前只 pin iOS SDK；如果未来引入 Android AAR，按 §7 的扩展方式加入同一 manifest。

## 6. 替换方案

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
首个接入对象就是 Onramper iOS SDK（我们已于本仓库外完成反编译级安全审计，
本目录 `OnramperSDK.md` 即该审计结论；lint 用于防止审计过的字节被替换）。

**实现**（`development/lint/external-sdk.js` + `external-sdk.config.json`）：

- manifest 按 **173 个文件（30.3 MB）** 记录每个文件的 SHA-256 + size，覆盖 App 实际消费的全部可执行内容：
  `ios/`（xcframework 全量 + podspec 编译的所有 Swift/ObjC 源文件）、`lib/`（RN 实际加载的 JS 产物）、
  `src/`（Metro 源码入口）、`nitrogen/`（生成的原生绑定）、`OnramperReactNative.podspec`、
  `app.plugin.js`、`nitro.json`、`package.json`、`LICENSE`、`NOTICE`；
- 同时 pin npm 包版本（`1.3.1`）；
- 校验规则：
  - 文件内容变化 → `MODIFIED`，失败；
  - 新增文件（如注入的 `.dylib`/插件）→ `UNEXPECTED`，失败；
  - 文件缺失 → `MISSING`，失败；
  - 包版本变化 → 失败；
  - 目录中出现 symlink → 直接拒绝（防绕过）。
- 命令：
  - `yarn lint:external-sdk`（CI / `lint:project` / `agent:check` 已接入）；
  - `node development/lint/external-sdk.js --write`（评审后重新 pin，必须 review diff）；
  - `--json` 机器可读输出。
- 测试：`development/lint/external-sdk.node-test.js` 共 **13 个用例**，覆盖 clean / 修改 JS（P0 回归）/
  注入同级 Swift（P1 回归）/ added / missing / version-mismatch / symlink file / symlink dir /
  symlink root / json / 未初始化 manifest；CI 的 `01-lint` workflow 已执行该测试。
- 扩展方式：在 `external-sdk.config.json` 的 `sdks[]` 追加条目即可接入下一个
  二进制 SDK（Android AAR、其他 xcframework 等）。

## 8. 合规与许可（需法务确认）

- 厂商随包提供 `LICENSE` + `NOTICE`，NOTICE 明确：
  **“OnramperSDK … This product is licensed under the Apache License, Version 2.0.”**
  npm 包 `license` 字段亦为 Apache-2.0。因此重建/修改/分发在版权层面被许可，
  但必须履行 Apache-2.0 义务：
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
