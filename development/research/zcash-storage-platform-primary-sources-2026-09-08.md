# Zcash 存储替换的平台约束：官方资料调查

调查日期：2026-09-08。本文只回答平台能力与迁移约束，不认定 OneKey 当前在哪个宿主启用了 IndexedDB；实际调用链由配套代码调查确定。未执行设备测试。以下明确区分官方事实与工程推论。

## 可直接确定的事实

### Web 与浏览器 Worker

OPFS 是浏览器提供的按来源隔离文件存储；采用它仍然可以保留 SQLite WASM。File System 标准把同步访问句柄暴露给 DedicatedWorker，并要求 secure context；不能把任意 Worker（例如 ServiceWorker）都视为满足条件。默认读写句柄的排他锁意味着另一个实例不能随意同时打开同一文件。[File System 标准](https://fs.spec.whatwg.org/#api-filesystemfilehandle-createsyncaccesshandle)

SQLite 官方 `opfs` VFS 需要 Worker、SharedArrayBuffer 和 COOP/COEP；它的子 Worker 实现不兼容 Safari 17 以前版本。`opfs-sahpool` 无需这些隔离头，但其文件池会持有访问句柄，不能提供透明多实例并发；较新版本提供协作暂停/恢复。这些属于 **SQLite 官方 JS/WASM VFS 的条件**，不是所有 OPFS 实现的统一要求，更不证明当前 Rust `sqlite-wasm-vfs` 可以直接切换。[SQLite 持久化文档](https://www.sqlite.org/wasm/doc/trunk/persistence.md)

### iOS / WKWebView

WebKit 的存储配额和清理政策同时覆盖 IndexedDB 与 File System。自 iOS 17 等版本起，普通非浏览器 App 的 origin 配额上限为磁盘的 15%，整体上限为 20%；这些是上限而不是保证可用容量。默认 best-effort 存储可能因压力等被清理，`persist()` 申请由启发式规则决定。[WebKit 存储政策](https://webkit.org/blog/14403/updates-to-storage-policy/)

WKWebView 的默认 `WKWebsiteDataStore` 会持久化到磁盘，`nonPersistent()` 只保存于内存；必须检查实际 WebView 配置，不能仅凭“WebView 支持 IndexedDB”断言数据跨重启存在。[Apple WKWebsiteDataStore](https://developer.apple.com/documentation/webkit/wkwebsitedatastore)

**推论：** 改 OPFS 不能消除 WebKit 的 origin、配额、数据清理、WebView 生命周期风险。若希望脱离这些政策，需要讨论 App 自己管理的原生文件及数据库宿主，这属于另一条架构路线。低版本系统上的支持范围必须以实际 VFS 与真实 WebView 测试为准。

### Android / WebView

Android 官方支持通过 WebView JavaScript 接口连接原生功能，但提醒桥接接口会对页面 JavaScript 暴露宿主能力。[Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview)

**推论与待验证项：** 原生 SQLite 接入需要显式的桥或原生 Rust 宿主，不能用 JavaScript import 自动把 WASM 的同步 SQLite I/O 变成原生 I/O。OPFS 方案应在 App 实际支持的 WebView 上逐项探测 secure context、DedicatedWorker、同步句柄、持久化重启和锁竞争，不能用“Android 支持”代替这些验证。本次没有获得足以给出 OneKey 最低 Android WebView OPFS 版本保证的证据。

### Electron 桌面

Electron session 的 partition 带 `persist:` 前缀时会持久化，同名 partition 的页面共享该 session；无该前缀的显式 partition 为内存 session，空值使用默认 session。`clearStorageData()` 能清理 IndexedDB、filesystem 等存储。[Electron session](https://www.electronjs.org/docs/latest/api/session)

**推论：** 选择 OPFS 仍应核对 Chromium 版本、origin 与 session partition；选择原生 SQLite 则应定义数据库文件的进程所有者、关闭顺序和 IPC。OneKey 桌面 main/bg 是单 JS runtime，不能据此推断 Electron 所有进程或新增原生 DB 宿主也在同一 runtime。

### Chrome 扩展 / offscreen

扩展 origin 的存储由 service worker、扩展页面和 offscreen document 共享，content script 使用网页 origin 的存储。IndexedDB 可在 service worker 使用。`unlimitedStorage` 可解除扩展及 Web 存储的配额限制和驱逐；默认扩展存储不能假设享有该保护。[Chrome 扩展存储](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)

Offscreen API 从 Chrome 109 / MV3 起提供，offscreen document 只能调用 `chrome.runtime` 扩展 API；`WORKERS` 是创建该文档的可用 reason，用于需要生成 Worker 的场景。[Chrome offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen)

**推论：** offscreen 可以作为 DedicatedWorker 宿主候选，但“已有 offscreen”不证明 OPFS 已可用；还要核验扩展 CSP、资源 URL、VFS 的跨源隔离要求和文档重建。该文档本身不是原生 SQLite 进程。

### 本地 file URL 的额外约束

Secure Contexts 规范一般把 `file:` 看作 potentially trustworthy，但允许浏览器采取更严格策略；opaque origin 另有不可信规则。因此既不能说“file 必然不安全、OPFS 必然不可用”，也不能说“本地文件必然支持 OPFS”。[W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy)

Android 官方提供 `WebViewAssetLoader`，把本地资源放在 HTTP(S) 风格 URL 下加载，以兼容同源策略。[Android WebViewAssetLoader](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader)

**推论：** 对使用本地 HTML 的 WebEmbed，应在内置资源和更新包两条加载路径分别验证 `location.origin`、`isSecureContext`、`navigator.storage.getDirectory()`、实际 Worker 创建、同步句柄写入/flush/重启读取。若改用 HTTPS 风格本地资源 origin，需要同时解决旧 IndexedDB 数据的可访问性；改变宿主 origin 不能当成透明的 URL 改写。

## 迁移与持久化：不能只删补丁

SQLite 的事务持久性依赖 VFS `xSync` 和 `synchronous`/journal 模式。例如 WAL + NORMAL 允许最近提交在系统崩溃或断电后回滚；WAL + FULL 每次提交同步。替换底层并不自动证明“提交成功等于需要的持久化保证”。[SQLite synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous)

对正在写入的 SQLite 文件直接复制可能产生不一致快照；SQLite 提供 Online Backup API 获取一致快照。[SQLite Backup API](https://www.sqlite.org/backup.html) 数据库 journal/WAL 与主文件配套，绕过正常锁定、同步和恢复流程可能破坏数据库。[SQLite 损坏原因](https://www.sqlite.org/howtocorrupt.html)

据此，工程上建议以下迁移门槛（这是方案建议，不是已经完成的实现）：

1. 先确定每端唯一数据库所有者；iOS/Android/extension 的 main、bg 独立初始化，不能依赖 JS 单例跨堆锁定。跨边界传输的是消息/副本，原生资源共享范围需要单独定义。
2. 暂停扫描与交易写入，并等待现有 IndexedDB 写队列确认完成；取得一致快照后导入新后端。
3. 检查 schema、账户映射、扫描位置、待广播/已广播交易及完整性；写入可恢复的迁移状态后再切换读取来源。保留可回滚的旧数据，避免回滚版本继续写另一套库造成分叉。
4. 注入导入中断、磁盘满、关闭 Worker/WebView、App 强退、双实例竞争，验证重启恢复及错误上报；需区分应用退出与系统断电保证。
5. 只有不再存在任何 `relaxed_idb` 生产路径或迁移读取路径，且新后端证明了关键交易确认语义，才评估移除相应 barrier 调用与 patch。若分端迁移，仍使用旧后端的端需要继续保留补丁。

建议方向：先完成实际平台矩阵和迁移数据分类，再分别评估“WASM + OPFS”与“原生 Rust/SQLite + App 文件”。不应把两条方案都笼统称作“IndexedDB 换 SQLite”。

## 2026-09-08 补充：按开发阶段的新目标选择架构

用户进一步明确：不要求迁移旧数据或兼容旧实现，优先最佳交互体验、速度、流畅度和合理的 WASM 体积。因此前节的旧数据迁移门槛不再属于本次新方案的交付要求；正常运行中的事务持久化、退出恢复和唯一所有者仍是设计约束。下列是基于官方机制的架构建议，**没有宣称经过基准验证的原生提速比例**。

### 推荐的分端方向

| 平台 | 建议计算宿主 | 建议数据库后端 | 资源边界 |
| --- | --- | --- | --- |
| iOS / Android | 原生 Rust 工作线程/执行器，由异步 Native Module 暴露高层命令 | 同一原生服务持有 SQLite 连接，App 私有文件 | main/bg 两个 JS runtime 通过消息调用同一原生所有者；不在两个 JS 堆中各持有整个钱包数据库 |
| Electron | 独立 utility process 加载 Rust 原生模块，重任务在该进程内调度 | 原生 SQLite，utility process 持有连接与文件 | App main/bg 仍为单 runtime；新增 utility process 是单独进程资源，不把两者混淆 |
| Web | DedicatedWorker 执行 Rust WASM | 单所有者条件下优先评估 OPFS sahpool 类 VFS | 页面只持有展示状态；数据库/扫描状态留在 Worker，多个页面协调所有权 |
| 扩展 MV3 | offscreen 宿主创建 DedicatedWorker 执行 Rust WASM | 同上，需实际验证扩展环境能力 | bg 与 UI 分堆；offscreen/Worker 生命周期独立，bg 负责服务就绪与重建 |

这是保留一套 Rust 业务核心、分别提供 native 与 WASM 宿主的建议，不要求把查看密钥、扫描或证明工作交给远端。

### 移动端：异步接口不等于独立重任务线程

React Native Android 文档明确不应假设原生模块调用所在线程，阻塞重任务应交给模块内部管理的 Worker；iOS 文档也要求长任务显式选择自己的执行队列。二者引用的是 legacy API 文档，其具体默认队列不能外推到 TurboModules；新架构允许同步原生访问，进一步说明不能因接口叫 Native Module 就假设它不会阻塞 JS。[RN Android 线程说明](https://reactnative.dev/docs/legacy/native-modules-android#threading)、[RN iOS 线程说明](https://reactnative.dev/docs/legacy/native-modules-ios#threading)、[RN 新架构](https://reactnative.dev/blog/2024/10/23/the-new-architecture-is-here)

**设计推论：** JS 入口只做参数校验、任务入队和异步结果回传；Rust 扫描/证明/SQLite I/O 显式运行在原生工作线程。长扫描分批处理并给交互查询和取消让出调度机会；否则虽然 UI 不被直接阻塞，用户查询仍可能排在整段扫描后面。线程不意味着 App 可无限后台运行，暂停与恢复需遵守各端生命周期。

SQLite 的 multi-thread 模式禁止同一连接及其派生对象被多个线程同时使用；serialized 模式可将调用串行化。[SQLite 线程模式](https://www.sqlite.org/threadsafe.html) **设计推论：** 先用单数据库所有者串行执行写任务，需要并行证明时使用不共享 DB 连接的计算任务；不要通过多个 JS runtime 分别打开连接来获得“并行”。

### Electron：utility process 是原生宿主候选，不是性能保证

Electron 官方把 utility process 定位为 Node 环境中的独立子进程，适合 CPU 密集或容易崩溃的组件，并可通过 MessagePort 与 renderer 通信。[Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model#the-utility-process) API 在 App ready 后启动子进程，支持退出事件及消息通道；macOS 加载库涉及签名，默认不启用加载未签名库选项。[utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)

Electron 支持原生 Node 模块，但需要满足 Electron ABI、平台及架构条件。[Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) **设计推论：** Rust addon 可放入该宿主，需验证实际打包、签名与加载；不是把任意现成 Node 二进制放进去就可运行。进程隔离能把计算和异常从 UI/main 线程移开，但增加启动、内存和 IPC 成本，因此不能据此断言它一定比现有 WASM Worker 总耗时更短。初始化可按 Zcash 需求懒启动，结果以小批次回传，避免全量数据库穿过 IPC。

### WASM 最小：区分首用体积与总发行体积

以下为构建与数据流推论，需由实际产物测量确认：

- 移动端与桌面使用 native 后，可以不发行该端不需要的 Zcash WASM，但会增加对应架构的原生库；“WASM 为零”不等于安装包总大小为零或必然更小。
- Web/扩展把重证明代码按需加载，能减少首次查看钱包所需的字节和编译工作；总下载/发行大小仍是各模块之和，重复链接密码学代码反而可能增加总量。不能只把单文件拆成两个就声称真正瘦身。
- 优先依据功能划分 scan/read 与 prove 等构建边界，测量公共代码重复、初始化时间、峰值内存和第一次发交易延迟，再决定是否拆模块。证明模块不拥有数据库，输入输出需定义为有限的任务数据，避免复制整个钱包状态。
- OPFS sahpool 类后端适合明确单所有者模型，但当前 crate 能否支持、WASM 页缓存是否受控以及实际随机 I/O 性能仍需验证；换存储名称不会自动缩小密码学 WASM。

在这个新范围下，可以直接构建目标后端，不保留仅为旧数据兼容存在的实现。验收应比较冷启动可交互时间、扫描期间 UI/查询延迟、扫描吞吐、首次证明耗时、峰值内存及各端发行产物大小，以这些结果调整线程、缓存和模块边界。
