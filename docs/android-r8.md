# Android Release R8 说明

## 目的与范围

GoogleRelease 和 ProdRelease 默认启用 R8 的代码缩减、优化和混淆，使用
`proguard-android-optimize.txt` 与应用的 `proguard-rules.pro`。目标是删除无用的
Java/Kotlin DEX 代码、允许编译优化，并改善 Google Play 的 DEX 优化检查结果。
运行时通过 JNI、反射或固定名称访问的入口必须继续可用。

Android 的 `main` 和 `bg` 是独立 JS 运行时，随同一个原生包发布。DEX 和 `.so`
由原生进程加载；JS 对象和堆各自独立，数据在各运行时分别反序列化，初始化顺序也
各自独立。因此保留规则同时覆盖前台和后台的原生入口，不能只验证前台启动。
Hermes JS 分包和 Android 资源缩减是独立机制；本改动没有启用资源缩减。

`android.enableProguardInReleaseBuilds=false` 可用于本地诊断对照。发布构建应保持
默认开启，并检查最终 AAB 的 R8 元数据，避免依赖的 consumer rules 悄悄关闭优化。

## 依赖为什么排除或保留

| 依赖 | Google | Prod | 决策原因 |
| --- | --- | --- | --- |
| `purchases-store-amazon` 及其 Amazon Appstore SDK | 排除 | 排除 | `react-native-purchases` → `purchases-hybrid-common` 间接引入。应用配置选择 Google Play，旧桥接也明确传入 `useAmazon=false`，两个 flavor 均无 Amazon 支付入口。该模块附带全局 `-dontoptimize`，会阻止整个应用的 R8 优化。 |
| `play-services-location` | 排除 | 保留依赖，由 R8 缩减 | Google Billing 间接引入。扫描两个 flavor 的运行时依赖，没有找到对其类的直接引用、类型签名或完整类名字符串引用，且该 AAR 没有注册运行时组件。Google 的极光 FCM 插件保留了全部 `com.google.android.gms.**`，使未使用的 Location 也留在包中，因此仅对 Google 显式排除。Prod 的 R8 已能自动删除这些类。 |
| `play-services-ads-identifier` | 保留 | 保留 | 当前 Prime 的 Mixpanel/PostHog 标识同步不会触发广告 ID 采集，但 RevenueCat 仍保留设备标识采集 API。广告 ID 调用处理了 `NoSuchMethodError`，没有处理整个依赖缺失的 `NoClassDefFoundError`，不能只凭业务没有直接调用就删除。 |
| `play-services-auth-blockstore` | 保留 | 保留 | RevenueCat 自动参与登录、购买及恢复流程。它备份和恢复匿名订阅用户标识，SDK 虽有依赖缺失时的降级分支，删除仍会改变恢复能力。当前 Prime 购买前会登录 OneKey 用户，但这个事实不足以覆盖历史匿名身份及重装恢复场景。 |
| RevenueCat 核心、Hybrid Common、Google Billing | 保留 | 保留 | Prime 的订阅、商品查询、购买和恢复依赖它们。排除可选商店模块不能连带排除支付核心。 |

Amazon 适配器和 `ProxyAmazonBillingActivity` 仍存在于 RevenueCat 核心 AAR 中。
本改动排除的是独立 Amazon 商店模块及 Appstore SDK；检查时应核对依赖坐标和
SDK 类是否消失，不能用“包内没有任何 Amazon 字符串”作为验收条件。

以上结论对应 `react-native-purchases 10.4.3`、RevenueCat Android `10.13.0`、
Hybrid Common `18.21.0` 和 Google Billing `8.3.0`。SDK 升级后应重新检查依赖图、
consumer rules 和实际调用。静态扫描无法穷尽动态拼接名称或 native 动态查找；
真实支付和恢复仍是发布前的验收项。

## 为什么需要应用级保留规则

R8 能分析普通 Java/Kotlin 调用，但 Rust/C++ 的固定 JVM 名称、反射字段和 JCA
Provider 注册字符串可能没有可追踪的普通调用。应用级规则补齐这些边界，避免为
整个 OneKey 包或所有第三方依赖增加统一的 `-keep`。

| 保留对象 | 必须保留的契约 | 规则范围与原因 |
| --- | --- | --- |
| Nitro `HybridObject` 具体子类 | 类名和公共无参构造器 | 生成的 JNI 工厂通过固定类名创建对象。保留具体子类及无参构造器，其他成员继续遵循生成代码的注解和 consumer rules。 |
| SplitBundleLoader / BackgroundThread 的 `SegmentEvalCallback` | 接口名、`onComplete(String)` 及实现方法名 | C++ 使用固定 JVM 签名回调；同时覆盖 `main` 和 `bg` 分段加载完成回调。 |
| Google Sign-In Activity listener | 类名前缀、`onActivityResult` | 后台 Activity 桥接按原始类名前缀匹配监听器，混淆后可能无法转发结果。 |
| `BundleUpdateStoreAndroid` | 单例 `INSTANCE` 和两个静态查询方法 | SplitBundleLoader 反射查询 OTA 主包路径及分段哈希要求；保留名称和入口，允许方法体优化。 |
| `OneKeyLog` | 四个静态日志方法 | native 模块可通过反射调用日志入口；只保留这些入口，允许方法体优化。 |
| JPush / JCore | `cn.jpush.**`、`cn.jiguang.**` | 闭源 SDK 内部同时使用 JNI、反射和组件入口，现有证据不足以安全缩小到少数方法，因此保守保留。没有额外增加全局 GMS/Firebase 保留规则。 |
| JNA 及其外部子类 | 回调、结构体及字段的反射契约 | JNA 动态解析 native 回调和结构体；也必须覆盖位于 JNA 包外的生成桥接子类。 |
| Realm `SSLHelper` | 固定类名及成员 | Realm 的 `JNI_OnLoad` 查找固定 TLS helper；更名或删除会导致 native 初始化失败。 |
| Juicebox DTO、错误枚举和异常 | JVM 名称、字段和构造器 | Rust JNI 通过名称构造和读取 `Realm`、`RealmId`、HTTP DTO 及操作错误。仅保留实际 JNI 使用的这些类型，允许优化。 |
| Juicebox 两个回调接口 | 接口及具体实现的 `get` / `send` 方法签名 | Rust 调用鉴权和 HTTP 回调；实现类本身可以混淆，但接口及方法契约必须稳定，方法体允许优化。 |
| BouncyCastle GPG 异常 | 存活异常类的简单名称 | 校验结果的 `ERROR_*` 原因包含异常 `simpleName`；`-keepnames` 稳定诊断值，同时允许删除无用异常类型。 |
| BouncyCastle RSA / SHA-2 JCA 服务 | 映射类、实现类名称和公共无参构造器 | JCA Provider 通过字符串加载 RSA KeyFactory、SHA256/384/512 Signature 和 Digest 服务。类存在但构造器被移除也会失败。保留这组实际服务，允许方法体优化。 |
| SHA256 / SHA384 / SHA512 外层类名 | 与 `$Digest` 实现一致的名称前缀 | BouncyCastle 映射通过外层 `class.getName()` 生成实现名称；只保留内部实现类会导致前缀与真实类名不一致。 |
| Expo Activity delegate 字段 | `mDelegate`、`mReactDelegate` 名称和正确字段类型 | Expo 使用反射读写字段，其上游规则省略类型包名。应用规则写全限定类型，保护实际字段。 |

`-keep,allowoptimization` 保留类或成员的存在和名称，同时允许优化实现。
`-keepclassmembers` 只保护被匹配成员，不单独强制实例所属类存活。
`-keepnames` 只稳定存活对象的名称，未使用的类型仍可删除。

## 没有额外整包保留的内容

- React Native、Expo、EventBus 等已有生成注解或 consumer rules 的契约，先检查
  最终合并配置和 DEX，再补缺失规则。例如 `ReactContext` 的三个 Activity/lifecycle
  字段和 EventBus 的 `Subscribe` 已有上游规则覆盖，没有重复增加保留。
- 其他 OneKey 模块继续依赖正常可达性分析、Nitro 生成注解和各模块 consumer rules。
  本改动没有统一保留所有 `com.margelo.**` 或所有 OneKey SDK 类。
- BouncyCastle 没有整包保留；未使用的算法、异常及构造器可以被删除。验收不能
  强制要求无用异常类型或从未使用的构造器继续存在。
- 未使用的可选模块优先从依赖图中移除；仍有业务或 SDK 调用的依赖保留后交给 R8
  按可达性缩减。缩减结果允许 Google 和 Prod 不同。

## 为什么仅忽略少量缺失类警告

`-dontwarn` 只控制缺失类诊断，不会补出运行时类，也不能替代 JNI 保留规则。
目前只补充了两个已核对的可选分支：

- `cn.jiguang.dy.JDynamicLoadBase`：当前 JCore 构建关闭了对应的可选动态加载分支。
- 四个 `java.awt` 类型：JNA 的桌面窗口句柄 API 引用，Android 不提供 AWT。

应用没有增加全局 `-ignorewarnings`，也没有用 `-dontoptimize`、`-dontshrink` 或
`-dontobfuscate` 来绕过错误。新增缺失类时应先定位真实依赖和调用，再决定修复
依赖、补保留还是对已确认不会执行的可选分支使用精确的 `-dontwarn`。

## 验证与发布边界

使用 JDK 17，在仓库根目录运行 `yarn agent:check --profile commit`；PR 就绪前运行
`yarn agent:check --profile pr`。完整原生构建示例：

```sh
cd apps/mobile/android
SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true \
  ENABLE_NATIVE_BACKGROUND_THREAD=true UNION_BUILD=true \
  SPLIT_BUNDLE=1 SPLIT_BUNDLE_SEGMENTS=true ANDROID_CHANNEL=google \
  NODE_OPTIONS=--max-old-space-size=8192 \
  ./gradlew :app:bundleGoogleRelease --no-daemon --max-workers=6 \
    -x uploadSentryProguardMappingsGoogleRelease
```

Prod 使用 `ANDROID_CHANNEL=direct`、`:app:bundleProdRelease` 及对应的 Prod Sentry
任务名。自定义 JS 构建脚本还会根据 `SENTRY_TOKEN` / `SENTRY_PROJECT` 决定是否上传；
纯本地验证应使用没有上传凭据的环境。默认本地签名配置用于测试，生产签名由发布
流程提供。

每次改保留规则或升级 SDK，至少检查：

1. 两个 flavor 的解析依赖符合表中决策；最终 DEX 没有 Amazon SDK，Google DEX
   没有 Location 类，Ads Identifier、Blockstore 和 Google Billing 仍可用。
2. AAB 的 `BUNDLE-METADATA/com.android.tools/r8.json` 中混淆、缩减、优化均开启；
   合并的 `configuration.txt` 没有全局禁用指令。R8 元数据百分比是本地指标，
   Google Play 的最终判定需要上传后的服务端检查。
3. 用 mapping 和 DEX 核对 JNI 类、方法、构造器、回调及反射字段；运行 bundletool
   包结构校验。增量原生验证复用 JS 时，逐文件校验包内 `main`、`bg`、`common`、
   分段及 module map 来自同一已验证渠道，避免混入另一个 flavor 的构建产物。
4. 在 release 包上验证清数据启动、后台通信、行情列表及图标；测试 Expo 反射、
   Google BillingClient 构造、Juicebox 的 Rust 鉴权和 HTTP 回调。
5. GPG 同时覆盖有效签名和拒绝路径：正式发布的 Android SHA256SUMS ASC 应返回
   预期哈希，篡改内容应被拒绝；签名有效但正文格式错误也必须被拒绝。

`ReactNativeAppUpdate.testVerification()` 目前内置的是签名 JSON 旧样本，而
`verifyDetachedAsc` 要求 SHA256SUMS 文本，因此该自检会返回 false。验证应使用
格式正确的正式 ASC 文件；本改动没有修改这个旧自检，也没有放宽签名或哈希检查。

JNI 合约、BillingClient 构造和模拟器启动通过，仍不能覆盖真实购买/恢复、
Juicebox 成功注册/恢复、Google 登录、完整 OTA/APK 升级回滚及硬件钱包通信。
这些流程需要单独验收。构建测试包和创建 PR 均不执行应用发布。
