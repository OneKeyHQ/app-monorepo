# Zcash 存储：当前多端接线、旧提案与替换风险

日期：2026-09-08。范围：当前工作区的 Zcash 本地钱包/隐私扫描路径，不代表所有普通透明地址操作都会初始化数据库。本文是源码与官方文档调查；没有进行真机、打包产物或断电测试，不能把“代码接到了 IndexedDB”表述为“所有设备的持久化已经验收”。本次不修改实现。

## 结论

1. 当前钱包运行时已使用 SQLite，但所有已接线的 App 平台都通过 WASM `relaxed_idb` VFS 将 SQLite 文件块保存到 IndexedDB。iOS/Android 当前也走 WebView，没有接上原生 Rust/SQLite 钱包宿主。
2. 早期确实存在移动端原生 SQLite 提案；它不是当前实现。更晚的存储评审建议保留 SQLite 协议层，按性能证据引入按页读写的存储适配。
3. OPFS 已存在于独立存储基准中，生产钱包初始化没有选择 OPFS 的分支。基准存在、甚至原生 Rust 测试通过，都不能证明 App 已切换存储。
4. 更换有实质性多端风险：运行载体、文件所有权、现有数据迁移、事务持久性、老系统/本地 URL 支持以及回退路径都要同时设计。目前不能删除 `relaxed_idb` barrier 补丁。

## 旧提案与当前实现的差异

- [2026-08-14 迁移架构提案](../../zcash-runtime-migration-architecture-guide-2026-08-14.html)：第 6/9 节规划 wallet WASM 与 iOS/Android native library；移动端 native singleton 由 bg 掌握调用权，WebEmbed 第一阶段仅 keys-lite；Desktop/Web 规划专用 Worker。它提出的是目标架构，不能当成当前状态。其账户分库、协议版本等其他历史主张也不能直接套用到当前代码。
- [2026-08-24 存储评审](../../zcash-runtime-storage-review-2026-08-24/index.html)：第 7 节已明确当前 `relaxed_idb` 整库预载，建议 Rust/SQLite 协议层保持一致；实测超预算时再引入 Worker/原生文件系统的 page-backed VFS。它没有记录“所有平台已经替换 IndexedDB”。
- 当前移动端 [WebEmbedApiChainZcash.ts](../../packages/kit-bg/src/webembeds/WebEmbedApiChainZcash.ts) 接入完整 `impl`，与早期 keys-only 规划不同。本文没有找到足够证据解释这一变更的全部历史决策，不能推定原提案已被正式采纳或取消。

## 当前存储调用链

`平台 SDK → impl/carrier.getRuntime → WASM init → install_persistent_vfs → relaxed_idb → IndexedDB`

- [carrier.ts:132](../../packages/core/src/chains/zcash/sdkZcash/impl/carrier.ts#L132) 导入 `onekey-zcash-runtime`，等待模块初始化，再 `await mod.init()`；没有按平台改选 OPFS/原生 SQLite。
- [bindgen.rs:33](../../../app-modules/chain-runtimes/zcash/crates/zcash-runtime/src/bindgen.rs#L33) 的 `init()` 调用 `install_persistent_vfs()`；[storage.rs:124](../../../app-modules/chain-runtimes/zcash/crates/zcash-runtime/src/storage.rs#L124) 直接安装 `relaxed_idb` 为默认 VFS。
- [carrier.ts:26](../../packages/core/src/chains/zcash/sdkZcash/impl/carrier.ts#L26) 按网络命名 `zcash-${network}.db`。一个网络的多账户共享数据库，迁移单位不能误设为单个账户。
- `Preload::None` 只推迟预载，随后打开目标数据库仍会把整个文件读入该载体的 WASM 内存。数据库不会因此自动变成按页读盘。[storage.rs](../../../app-modules/chain-runtimes/zcash/crates/zcash-runtime/src/storage.rs)
- Rust 的 `cfg(not(target_arch = "wasm32"))` 原生路径真实存在，但平台名称为 desktop/native 的 TypeScript 文件不等于使用了这条 Rust 原生路径。[Cargo.toml](../../../app-modules/chain-runtimes/zcash/crates/zcash-runtime/Cargo.toml)

## 各端当前在哪里使用 IndexedDB

| 平台 | App runtime scope 与 Zcash 载体 | 数据库/底层资源所有者 | 初始化、堆副本和接线证据 |
|---|---|---|---|
| Desktop：macOS/Windows/Linux | App main/bg 单 JS runtime；Zcash 默认另起 DedicatedWorker，失败回退 renderer 同线程 | Worker 的 WASM/SQLite 连接；回退后由 renderer 实例重开。底层 IndexedDB 属于 Electron session/profile 与页面来源，不属于 UI JS 堆 | Worker 消息产生 DTO 副本；不是 main/bg 各预载一份 DB。握手后才选载体。见 [index.desktop.ts](../../packages/core/src/chains/zcash/sdkZcash/sdk/index.desktop.ts)、[zcashSdkWorker.ts](../../packages/core/src/chains/zcash/sdkZcash/sdk/zcashSdkWorker.ts) |
| Web | main/bg 单 runtime，当前直接在页面线程执行 `impl` | 页面 WASM/SQLite；浏览器 profile 下按 origin 保存 IndexedDB | 每个实际初始化钱包的页面实例有自己的 WASM 堆；跨标签页不能依靠模块内 lease。见 [index.web.ts](../../packages/core/src/chains/zcash/sdkZcash/sdk/index.web.ts) |
| iOS | main/bg 独立 JS runtime；业务在 bg，通过桥接调用额外的 WebEmbed WKWebView runtime | WebView 中的 WASM/SQLite；底层由 WebKit website data store/origin 管理，不是 RN main/bg 共同持有一个原生 SQLite 连接 | main/bg 与 WebView 仅通过 RPC 交换反序列化结果；完整 DB 在打开它的 WebView 内预载。bg 与 WebView 独立就绪，必须等桥。见 [index.native.ts](../../packages/core/src/chains/zcash/sdkZcash/sdk/index.native.ts)、[WebEmbed 接收端](../../packages/kit-bg/src/webembeds/WebEmbedApiChainZcash.ts) |
| Android | main/bg 独立 JS runtime；业务在 bg，通过桥接调用额外的 WebEmbed 系统 WebView runtime | WebView 中的 WASM/SQLite；底层由系统 WebView profile/origin 管理，没有接入 App 原生 SQLite 文件 owner | 与 iOS 同类消息副本和独立就绪约束；WebEmbed 显式 `useGeckoView={false}`。见 [WebViewWebEmbed](../../packages/kit/src/components/WebViewWebEmbed/index.tsx) |
| Chromium 扩展 MV3 | main/bg 独立 JS runtime；bg service worker 转发到额外的 offscreen document | offscreen WASM/SQLite；同扩展 origin 的 IndexedDB 可被其他扩展上下文访问，不代表连接或锁共享 | main/bg/offscreen 有独立堆；RPC 结果分别反序列化；重建 offscreen 必须重开 DB。见 [index.ext-bg-v3.ts](../../packages/core/src/chains/zcash/sdkZcash/sdk/index.ext-bg-v3.ts)、[OffscreenApiZcashSdk](../../packages/kit-bg/src/offscreens/OffscreenApiZcashSdk.ts) |
| 扩展 MV2/Firefox 构建路径 | main/bg 堆隔离；无 Zcash MV2 专用入口时按 resolver 落到 `.web.ts`，在 background 页面执行 | background 页 WASM/SQLite；扩展 origin IndexedDB | 这是 [resolver](../../development/rspack/utils.ts) 与 [Firefox manifest](../../apps/ext/src/manifest/firefox.js) 推导的源码接线，不是 Firefox 实机可用性证明 |

底层同 profile/origin 的存储可能被多个上下文访问；每个 WASM 实例的内存、连接、模块内 lease 均不共享。现有上游 VFS 也明确警告多页面使用可能损坏数据库。[relaxed_idb.rs](../../../app-modules/chain-runtimes/zcash/vendor/sqlite-wasm-vfs-0.2.0/src/relaxed_idb.rs)

移动端 main/bg JS bundle 随版本锁定；若未来引入 native library，实际新增的是 native-vs-JS 能力/版本偏差，不能误设计成 bg-vs-main 版本协商。

## 已有 OPFS 是什么

[zcash-storage-benchmark](../../../app-modules/chain-runtimes/zcash/crates/zcash-storage-benchmark/src/storage_benchmark.rs) 独立安装 `relaxedIdb` 和 `opfsSahpool`，使用专属数据库/目录；[storageBenchmark.ts](../../packages/core/src/chains/zcash/sdkZcash/impl/storageBenchmark.ts) 用 Worker 测重开、强制终止和多实例。

Rspack 默认仅开发构建或 `ZCASH_STORAGE_BENCHMARK=1` 启用该入口，其他构建替换为 disabled 实现。[rspack.base.config.ts](../../development/rspack/rspack.base.config.ts) 基准将 IDB 配成 synchronous OFF、OPFS 配成 FULL，这种比较包含持久性语义差异，不能只看吞吐数字决定替换。本文没有执行基准，也不引用未核验的旧性能成绩。

## 两条替换路线及各端风险

路线 A：保留 Rust + SQLite WASM，将 VFS 后端换成 OPFS。路线 B：将钱包 Rust/SQLite 运行时托管到原生库/进程，使用 App 文件系统。两者都不应简称为“开始使用 SQLite”。

| 平台 | 路线 A：WASM + OPFS | 路线 B：原生 Rust/SQLite |
|---|---|---|
| Desktop | 已有 Worker 可作为首个验证载体，但当前 renderer 回退不能继续打开 Worker-only VFS；需明确不可用/崩溃恢复策略，核验实际 production origin | 需要独立 native module/utility process 等文件 owner 与 IPC、打包/签名/ABI。当前 renderer/Worker 均关闭 Node integration，不能直接 import Node SQLite 解决 |
| Web | 当前需要先增加 DedicatedWorker、跨标签页排他所有权与资源加载支持；不能自动沿用 IDB 回退读取另一套旧库 | 普通网页没有与 App 原生库等价的宿主；仍需浏览器存储方案 |
| iOS | WebView 内新增 Worker，还要验证本地 HTML、更新包 URL、WKWebView 生命周期、最低系统。不能只引用 Safari 支持表 | 对齐早期提案，但需 Rust 原生产物、桥、bg 调用权、单一连接 owner、挂起/恢复、版本握手；不是换一个 JS SQLite 包 |
| Android | 同样需 Worker；OS 最低版本不等于 WebView 引擎版本，需覆盖实际支持的 WebView 与本地资源加载 | 需 JNI/JSI/其他明确桥接、线程与数据库生命周期、native-vs-JS 版本能力；主/bg 不能各自创建未协调 owner |
| 扩展 | offscreen 内仍需新建 DedicatedWorker；service worker 不是该同步文件 API 的替代载体；MV2/Firefox 单列验证 | 普通扩展没有随包原生 SQLite 宿主；Native Messaging 需要另装宿主，属于产品架构变更 |

本地 `sqlite-wasm-vfs 0.2.0` 的 sahpool 实现会把 global 转为 `WorkerGlobalScope`，再取 storage directory，并调用同步 access handle；直接将当前页面中的安装函数替换成 sahpool 会失败。[sahpool.rs:119](../../../app-modules/chain-runtimes/zcash/vendor/sqlite-wasm-vfs-0.2.0/src/sahpool.rs#L119) 标准限定同步文件句柄在 DedicatedWorker 的安全上下文中使用。[File System 标准](https://fs.spec.whatwg.org/#api-filesystemfilehandle-createsyncaccesshandle)

需要同时注意以下已确认条件：

- 当前 iOS deployment target 是 16.4，Android minSdk 是 26，Electron 固定为 43.1.1，Chrome 扩展最低 111。它们来自 [Podfile.properties.json](../../apps/mobile/ios/Podfile.properties.json)、[gradle.properties](../../apps/mobile/android/gradle.properties)、[desktop package.json](../../apps/desktop/package.json)、[chrome_v3.js](../../apps/ext/src/manifest/chrome_v3.js)，不采用技能文档中的旧版本值。
- 移动 WebEmbed 内置资源/更新包走本地文件，开发可走远程 URL。[WebViewWebEmbed](../../packages/kit/src/components/WebViewWebEmbed/index.tsx) file URL 的实际 origin/API 可用性必须实测；不能直接断言必然支持或必然不支持。修改加载 origin 还会影响旧 IDB 可访问性。[Secure Contexts 标准](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy)
- Desktop 正式窗口也使用 `PROTOCOL = 'file'`，开发常走 localhost；因此 OPFS 验证必须包含正式包。[app.ts:225](../../apps/desktop/app/app.ts#L225) 当前 offscreen 创建 reason 是 `BLOBS`，新增 Worker 后还应让创建理由与实际用途一致，并核验重建流程。[keepAlive.ts](../../apps/ext/src/background/keepAlive.ts)
- OPFS 仍是浏览器来源存储，不能自动消除配额、清理和来源隔离问题。[WebKit 存储政策](https://webkit.org/blog/14403/updates-to-storage-policy/) 当前扩展 manifests 已声明 `unlimitedStorage`；不能把普通 Web 的 quota 风险原样当作扩展的已知限制。[Chrome 扩展存储说明](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)
- SQLite 官方 `opfs` 与 `opfs-sahpool` 的要求不同，不能统一宣称 OPFS 必须 SharedArrayBuffer/COOP/COEP；本项目选择的 Rust VFS 还需单独验证。[SQLite 持久化文档](https://www.sqlite.org/wasm/doc/trunk/persistence.md)

## 数据迁移和补丁退出条件

数据库包含可重扫的数据，也包含 runtime 自己维护的待广播/已广播恢复状态。[tx_state.rs](../../../app-modules/chain-runtimes/zcash/crates/zcash-runtime/src/tx_state.rs) 当前 `removeAccount` 会阻止删除有未结算交易、未决广播或活动 reservation 的账户。[bindgen.rs:220](../../../app-modules/chain-runtimes/zcash/crates/zcash-runtime/src/bindgen.rs#L220) 因此旧注释中笼统的“都是缓存、可删除重扫”不足以作为迁移策略。

建议的迁移事务顺序（尚未实现）：

1. 以网络库为单位取得排他所有权，暂停扫描与交易写入；明确处理活动 proposal、签名中交易及未决广播，不自动释放可能已花费的输入。
2. 等待现有 IDB barrier，取得一致数据库快照；不能在仍写入时随便复制主文件。运行时当前没有公开完整数据库导出/导入迁移 API，需要补充设计。[SQLite Backup API](https://www.sqlite.org/backup.html)
3. 导入新后端，核对 schema、网络、账户映射、余额、扫描状态、pending/raw transaction 与完整性；再次关闭重开验证。
4. 通过可恢复的迁移标记切换唯一权威存储。旧库可保留作只读恢复资料，但切换后新库已有交易写入时，不能简单切回旧库；不得双写两套库或以“新库打不开”自动启用旧库。
5. 注入每个迁移阶段的退出/存储满/载体崩溃，确保恢复只选一个一致状态；待跨版本回退策略落实后再清理旧数据。

当前 barrier 是“等待此前 IDB transaction 完成并上报错误”，不是已经证明硬件断电持久性的声明。换存储后仍要定义交易成功返回前需要的 flush/journal 保证，不能只删 `await`。[SQLite synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous)

只有实际使用旧 VFS 的所有生产平台和迁移读取路径都退出，才可移除第二个 patch。若仅 Desktop 切换，其他端仍需它。第一个 no-bundled patch 在仍保留 SQLite WASM 的路线 A 中也不会自然消失。

## 下一步验收范围与决策建议

建议先选择路线并做一个平台的完整迁移验证，不直接全端替换。Desktop 的现有 Worker 是 OPFS 的合理首个验证点；移动端若要兑现 8 月原生提案，作为独立 native adapter 项目评估，不用 Desktop 的结果替移动端背书。

每个平台必须记录以下数据；本次状态均为待运行验证：

- 实际载体、URL/origin、secure context、引擎版本、IndexedDB 与 OPFS API 探测；OPFS 必须实际写入、flush、关闭、重开读取，不能只检查属性存在。
- 内置资源与更新包、冷启动/升级、锁屏/前后台、WebView/offscreen 重建、Worker crash/fallback、Web 多标签页和双实例文件锁。
- 固定小/中/大网络库的打开耗时、峰值 WASM/进程内存、扫描吞吐、存储占用和延迟；统计逻辑 SQLite bytes 与 origin/profile 总量时分别标注。
- 含待广播、广播未知、已接收未确认交易的迁移；中断/重启后不丢 raw transaction、不错误解锁输入、不重复建立相互矛盾的发送意图。
- 存储满、损坏与清理后的错误上报；备份/迁移来源不可读时禁止静默创建空库并伪装成功。
- iOS 16.4 与较新系统、支持范围内的 Android WebView、最低及当前 Chromium 扩展、Firefox、Web 的实际浏览器范围；没有实测结果时保持“待验证”。

官方资料与更详细的平台约束见 [配套调查](zcash-storage-platform-primary-sources-2026-09-08.md)。当前能够确定的是接线、缺失的迁移实现及必需约束；尚不能承诺性能收益或全端无损迁移。
