# Zcash 统一运行时方案 — 2026-09-08

当前决定：所有 App 平台共用同一套 Rust、同一组 WASM 产物、同一份 TypeScript SDK 和 SQLite VFS。
只按宿主改变 Worker 的创建与消息入口。开发阶段不做旧数据库升级迁移。
本决定替代先前的 native/wasm 分端建议；没有证据表明现在必须维护两套生产执行后端。

## 运行位置

| 平台 | App JS 拓扑 | 实际计算与存储位置 |
| --- | --- | --- |
| Desktop / Web | main/bg 单 runtime | 独立 DedicatedWorker |
| 扩展 MV3 | main/bg 分离堆 | bg → offscreen → DedicatedWorker |
| iOS / Android | main/bg 分离堆 | bg → WebEmbed → Blob DedicatedWorker |

Worker 具有独立 JS 堆，持有 WASM 实例、SQLite 连接、同步访问句柄和扫描状态。
OPFS 是浏览器 origin 所有的存储，句柄由 Worker 独占，不按 App main/bg 各开一套。
main/bg/WebEmbed/offscreen 初始化独立；桥接结果在接收堆反序列化，但整库不跨桥。
Desktop/Web 的 App 单 runtime 不代表新增 Worker 与 App 共享堆。

## 已实施的公共改动

- 各 SDK 入口使用公共 Worker transport；崩溃和 reset 拒绝旧请求，不重放发送，不回退 UI 线程。
- 移动端使用同一 Worker 入口的内联 Blob 包，避免 file URL Worker 加载失败；无 fallback 副产物。Blob URL 保留到 Worker 终止，修复加载器立即 revoke 导致 WKWebView 拒绝 OPFS 的问题。
- 所有端统一 OPFS SAH-pool，SQLite 按页访问，去掉整库 IndexedDB 预载和异步刷盘队列。
- 保持一个网络一个数据库、多账户共享扫描；`DELETE` journal + `FULL` synchronous。
- 公共 VFS 修复连接级锁、hot journal 判断、日志删除 flush、部分初始化失败的句柄释放。
- 元数据 I/O 错误后停止 VFS 服务，通过明确状态通知宿主销毁该 Worker，保留当前调用的结果或错误。
- Worker 终止不等于文件句柄立即释放；新 VFS 初始化只对句柄占用做有限等待，不重试业务操作。

Chromium 对忙 Worker 的强制终止有两秒延迟，这解释了测试中 200ms/1000ms 重开时的句柄占用。
[Chromium worker_thread.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/workers/worker_thread.cc)

## 体积和性能边界

keys 与 wallet 继续按功能拆分；keys 不依赖 SQLite、网络、扫描和 prover。
当前 prover 属于 wallet runtime，不能仅凭旧注释声称有独立 prover 包。
移动端自包含 Worker 同时携带两份模块，WASM 实例仍按需初始化；不能把延迟实例化说成安装包变小。
WebEmbed 体积检查对共同资产只计一次，保留既有 7.1 MB gzip 合计预算，并要求两种模块均存在。

Worker 隔离解决 UI 线程被扫描/证明阻塞的问题，OPFS 消除整库镜像的内存下限。
这不是“所有操作已实测更快”或“数学上最小 WASM”的结论；真实钱包扫描、首用、证明耗时与峰值内存仍需对应设备测量。
暂不增加线程池、SharedArrayBuffer、原生 SDK 分支或 prover 拆包，避免在无数据时扩大实现和测试面。

## 已取得的验证证据与剩余边界

- 最终使用生产 WebEmbed 配置构建实际 `workerClient` + Worker factory，在 Electron 43.1.1 和 iOS 26.5 WKWebView 中加载两份 WASM、读取 capabilities 和 OPFS 数据库诊断，确认带 issuer 限制的加载器替换实际命中。
- iOS 26.5 也通过同一合成脚本的第八次页写入中断恢复，以及忙 Worker 接管、真实钱包 schema 初始化、重复读连接和 quick_check。
- 同步 API 探针在 iOS 两次应用启动间读回持久化数据；iOS file URL Worker 失败而 Blob Worker 成功。
- 对照 SQLite 合成测试：1000 行 baseline，在第八次主库页写入（offset 69632）中断。未修复 VFS 重开后 `generationSum=10`，存在未提交更新，尽管 `quick_check=ok`；修复版恢复为已提交的 `generationSum=0`，行数、checksum 和完整性均一致。
- 初始化第三个句柄申请失败后，同一 Worker 再次初始化成功；元数据 flush 和短写故障报错，并阻止后续 I/O。真实钱包 WASM 的 poison 状态导出返回 true；忙 Worker 退役后立即创建新 Worker，通过有限等待成功接管。
- 可重复运行：`node packages/core/src/chains/zcash/sdkZcash/scripts/verify-opfs-storage.cjs`，每个用例使用新 Electron profile，数据库只含合成数据。
- Worker 生命周期测试覆盖共享握手、超时、reset 竞态、崩溃不重放、结构化错误和 poisoned Worker 退役。

Android、最低支持 iOS、真实扩展生命周期和有资金 App UI 发送并未因以上测试而自动获得验收。
OPFS 仍受浏览器来源、配额与清理政策约束。保护广播未知状态与资金相关持久化，不以“开发阶段”作为放松理由。

规范实现说明见 [Zcash architecture](../../packages/core/src/chains/zcash/ARCHITECTURE.md)。

## 最终构建与检查

- `yarn agent:check --profile commit` 全部通过（lint、格式、TypeScript、background API contract）。
- Rust workspace：52 个测试通过，9 个联网测试保持 ignored；vendor 重建保护 6 个测试通过；VFS 纯锁状态测试 5 个通过。
- Worker / Blob 生命周期与发送策略：合计 20 个单元测试通过。
- release WASM 三个产物构建通过；真实 keys WASM 地址 golden 和 5 项合成种子清理测试通过。
- WebEmbed 生产构建、浏览器语法及包体检查通过；keys + wallet 唯一 gzip 资产为 6,382,060 B，低于既有合计 7,100,000 B 预算。
- wallet WASM 原始 7,415,606 B、gzip 3,632,948 B；keys 原始 2,307,462 B、gzip 1,647,387 B。wallet 比调整前减少 38,925 B 原始体积；这些数字不等于最终安装包增量。
