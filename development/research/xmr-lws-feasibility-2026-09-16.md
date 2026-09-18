# XMR LWS 方案可行性评估 + 本地扫描难度对比（vs Zcash）

Accessed: 2026-09-16
作用范围：回答三个问题 —— (1) LWS 方案是否可行、坑在哪；(2) XMR 本地扫比 Zcash 难多少、难在哪；(3) 选定方案怎么落地、各层选什么。

> **证据分级**。本文所有数字标注为三类之一：
> **[实测]** 对公共节点/真机的实际测量；
> **[一手]** 上游源码、官方规范、官方公告的原文；
> **[估算]** 按原语成本推导的量级，**没有实现可测**。
> 不要把 [估算] 当作可以写进需求文档的数字。

---

## 摘要

1. **LWS 方案可行**，协议层成熟、服务端软件有持续社区资助、我们旧代码本来就是 LWS 客户端。
2. **客户端库不再是空白（2026-09-16 实测更新）**：`monero-oxide/monero-wallet` 已实测编到 `wasm32-unknown-unknown`，**21 秒、零补丁，产物 226 KB**（含地址、扫描、交易构造、CLSAG 签名、Bulletproofs+ 证明），比仓库里那份 mymonero WASM 小 **10.9 倍**。缺的是**成品 LWS 客户端**，不是可用的加密层。插件端仍零先例。
3. **诱饵可以不交给服务器（2026-09-16 实测）**：已实跑验证我们能自己实现 `ProvidesDecoys`、用公共 monerod 的输出分布在本地选诱饵，从而消除 §1.6（2）的链上隐私风险。upstream 文档也明确建议这么做。
4. **已定：OneKey 自建并运营 LWS，同时保留用户自填**（2026-09-17）。该决策成立的前提是安全设计与部署同批上线、客户端可切换服务器、诱饵不用服务器选（§1.7）。我方将持有全体用户 view key —— 不可轮换、可追溯全历史、且无任何已有审计覆盖此形态。
5. **本地扫归一化到每笔交易，带宽是 Zcash 的 7.0 倍、试解密次数是 3.4 倍，单次解密成本两者相当**（均为结构性指标，与活跃度无关）。当前绝对带宽比为 13×，含 1.86× 的活动量快照因子，引用须标日期。
5. **但本地扫真正的阻塞不是算力，是三件结构性的事**：四个端各扫一遍、移动端只能前台扫、Monero 助记词不带 birthday。

---

# 第一部分：LWS 方案可行性

## 1.1 分项结论

| 维度 | 评级 | 依据 |
|---|---|---|
| 协议规范 | **成熟** | 规范在 `monero-project/meta` 官方仓库 |
| 服务端软件 | **可用，单点** | monero-lws，6 年持续 CCS 全职资助，但 bus factor = 1 |
| 客户端库（原生） | **成熟** | lwsf / monero_c，Skylight 在产 |
| 客户端库（WASM） | **可行，已实测** | `monero-oxide` 编 wasm32 通过，226 KB；成品 LWS 客户端仍需自写 |
| 公共服务器生态 | **不存在** | 无公共实例目录；Skylight 预置 0 台 |
| 插件端先例 | **零** | 全行业没有 |
| 我方运维负担 | **自建**：monerod + LWS 常驻运维 | 见 §1.7 / §3.4 |
| FCMP++ 升级路径 | **服务端已就绪，客户端待定** | monero-lws CARROT 分支已宣称可收可花 |

## 1.2 协议层：成熟，且是官方的

轻钱包 REST API 规范位于 `monero-project/meta` 的 `api/lightwallet_rest.md`，不是某家私有协议。

端点清单（我们要实现的客户端面）：

| 端点 | 用途 |
|---|---|
| `login` | 建账户 / 取 `start_height` |
| `get_address_info` | 余额、服务器扫描进度 |
| `get_address_txs` | 交易历史 |
| `get_unspent_outs` | 可花输出 |
| `get_random_outs` | 环签名诱饵（见 §1.6 风险） |
| `submit_raw_tx` | 广播 |
| `import_request` | 请求从创世扫描 |

FCMP++ 之后会新增 `get_tree_paths`（返回构造 FCMP++ 证明所需的树路径），并给子地址端点加 `generate_address_key`。**[一手]**

**我们旧代码本来就实现了这个契约的一半**：`packages/core/src/chains/xmr/sdkXmr/helper.ts` 的 `sendFunds(args, scanUrl)` 打的正是 `/get_unspent_outs`、`/get_random_outs`、`/submit_raw_tx`；`Lazy_KeyImage` 在本地算 key image。形状完全正确。

## 1.3 服务端软件：单人维护，但不是业余项目

`vtnerd/monero-lws`，BSD-3。**[实测 · 仓库元数据 2026-09-15]**

| 项 | 值 |
|---|---|
| 贡献者 | 13 人；vtnerd 占 86%（207/238 次提交） |
| 第二贡献者 | **j-berman，16 次** —— Monero 核心开发（view tags、后台同步、FCMP++ 整合的作者） |
| Issue | 23 open / 53 closed |
| PR | 198 closed |
| 版本 tag | v0.2.0(2022-12) → **v1.0.0(2026-09-09)** → v1.0.1 → v1.0.2(2026-09-16) |
| GitHub Releases 页 | 空（但 **tag 存在**，见上） |
| CI | ubuntu + macOS 双平台，`cmake build` + **`ctest`** |
| 单元测试 | 约 110 KB，`scanner.test.cpp` 54 KB（正确性关键路径覆盖最重） |
| "alpha" 的确切所指 | **仅 `master` 分支**；项目另有稳定发布通道 |
| 并入 monero-project | 六年未完成（README 仍写 "hopefully be merged"） |

**关键修正（2026-09-17）**：此前本节将其描述为"零正式发布版、master 自述 alpha"，**表述不准确** —— tag 存在且 **8 天前刚发 v1.0.0**；README 中的 "alpha" 仅指 `master` 分支，不指整个项目。

**另需注意四条开着的 issue，均直接命中自建场景**：

| Issue | 内容 |
|---|---|
| `#183`（2025-09） | 大量账户重扫时 **LMDB 写吞吐受限** |
| `#241`（2026-03） | 重扫时 `MDB_MAP_FULL`，**未设初始 mapsize** |
| `#156`（2025-03） | **自转账余额计算错误**，已开 18 个月 |
| `#261`（2026-06） | 有人询问单实例账户承载量，**上游无答案** |

**采纳前置条件**：① 自行做容量与压力测试；② 锁版本 + 自建构建，升级前备份（DB 迁移不可回滚）；③ 准备上游断供预案。

**资金面**：这不是无资金的业余项目。vtnerd 通过 Monero 社区众筹（CCS）**持续全职资助**在做，从 2020 年至今未断：

| CCS 提案 | 状态 |
|---|---|
| 2020 Q4 / 2021 Q1 / 2024 Q3 | 已完成 |
| 2025 Q1/Q2 | 已完成，134.37 XMR / 5 位出资人 |
| 2026 Q2 | 已完成 3/3 里程碑 |
| **2026 Q3** | **进行中**（2026-07-09 发起，97.06 XMR 已筹） |

2025 那期的工作范围明确包含 monero-lws 的：**fcmp++ 实验分支支持**、push 接口、**官方 Docker 镜像与预编译二进制**。最后一项说明维护者在做发布工程。

**另一个服务端实现 `moneroexamples/openmonero` 最后提交停在 2022-07-13**，等于 monero-lws 是唯一在维护的实现。

## 1.4 客户端库：加密层已验证可行，成品 LWS 客户端仍需自写

现存的所有 LWS 客户端实现：

| 库 | 语言 | 谁在用 | 能否 WASM |
|---|---|---|---|
| `vtnerd/lwsf` | C++ | lwcli | **否** |
| `vtnerd/monero_c`（fork 自 MrCyjaneK） | C | Skylight（再 fork 一层） | **否** |
| `EdgeApp/react-native-mymonero-core` | C++ / RN 原生模块 | Edge | **否** |
| `mymonero-core-cpp/js` | C++ → WASM | monero-web；**我们的旧代码** | 是，但**上游停在 2022-10** |

`monero_c` 的构建脚本目标只有 linux-gnu / android / apple / mingw，**没有 wasm**。**[一手]**

**结论：「能在浏览器/插件里跑的现成 LWS 客户端」在市面上不存在** —— 但**加密层已经有可用积木**（见下方实测）。需要我们自写的是 REST 层与装配，不是密码学。

### 候选方案

| 候选 | 形态 | FCMP++ 路径 | 风险 |
|---|---|---|---|
| 现有 mymonero WASM | 已在仓库里 | **不会有** —— 硬分叉当天交易被拒 | **不采用**；上游停更三年，且会让上层照其 API 写死。仅作契约参考 |
| lwsf + monero_c | C++，Skylight 在产 | 跟上游 | 要自己编 wasm，无人做过；LGPL-3.0 需法务确认 |
| **monero-oxide `monero-wallet`** | Rust，MIT，no_std，crates.io 0.2.0 | **作者即 FCMP++ 作者，Monero 官方反过来 git-pin 依赖它的 `helioselene`** | FCMP++ 代码仍在独立分支；无钱包产品先例 |

### 实测：monero-oxide 编到 wasm32 **[实测 2026-09-16]**

本机 rustc 1.98.1，`cargo build -p monero-wallet --target wasm32-unknown-unknown --release --no-default-features`：

| 项 | 结果 |
|---|---|
| 编译 | **通过，21 秒，零错误、零补丁** |
| 产物（cdylib，含签名与证明路径） | **225,626 B raw / 84,119 B gzip / 69,074 B brotli** |
| code section | 207 KB（非空壳） |
| 对比：仓库里的 `moneroCore.wasm.bin` | 2,456,152 B raw / 566,348 B gzip —— **大 10.9 倍** |
| no_std | 是（`default-features = false`），不需要 emscripten 或 WASI |

覆盖路径：`MoneroAddress::from_str`（base58 + 地址解码）、`Scanner::new/scan`、`SignableTransaction::new/serialize/unsigned_transaction`、`sign`（以具体 RNG 实例化，含 **CLSAG 签名 + Bulletproofs+ 证明**）。

**脱离守护进程的接缝已确认存在**：

- `OutputWithDecoys::new(rng, rpc: &impl ProvidesDecoys, ...)` —— `ProvidesDecoys` 是 **trait**，可自行实现
- `Decoys::new(offsets, signer_index, ring)` **是公开 API** —— 可直接塞 LWS `get_random_outs` 的返回
- `unsigned_transaction(key_images)` 与 `sign()` 分离 —— 存在 view-only / 离线签名接缝

### 实测：自己实现 `ProvidesDecoys`，喂公共 monerod 的数据 **[实测 2026-09-16]**

写了一个约 100 行的 `ProvidesUnvalidatedDecoys` 实现（正是 app 里要写的那一层），数据源为公共 monerod，只读、不广播。对主网实跑结果：

| 步骤 | 结果 |
|---|---|
| `latest_block_number` | ✓ 3,763,739 |
| `ringct_output_distribution`（走 blanket impl，**含 monero-oxide 自己的单调性校验**） | ✓ **2,543,214 个点通过校验**，末值 163,614,612 |
| `unlocked_ringct_outputs`（取 16 个真实链上输出当环成员） | ✓ **16/16 已解锁，且都能解压为合法曲线点** |

**结论：诱饵数据源可以完全由我们自己掌握，不必依赖 LWS 的 `get_random_outs`。**

> **补充（2026-09-17）**：`MoneroDaemon<T>` 上游**已实现** `ProvidesUnvalidatedDecoys`（`bin_rpc/mod.rs:180`）。因此在**直连 monerod** 的场景下无需自写。上述自写实现的价值在于证明该 trait **可在 crate 外实现** —— 这对 **LWS 路线仍然必要**，因为 LWS 协议不提供 output distribution 端点，其诱饵数据源必须另接。

两个必须记住的接口事实：
- `get_output_distribution` 是 `/json_rpc` 方法；`get_outs` 是 **直接端点 `/get_outs`**，不是 JSON-RPC（走错会得到 `-32601 Method not found`）
- 公共节点**确实提供** `get_output_distribution`（并非所有节点都开，实测三台中一台可用）

upstream 在 `ProvidesDecoys` 的文档注释里写着：

> "This SHOULD be satisfied by a local store to prevent attack by malicious remote nodes."

**这与 §1.6（2）的诱饵风险是同一件事，upstream 自己也这么认为。** 由此得到的推荐架构是：

| 数据 | 来源 | 交出什么 |
|---|---|---|
| 余额 / 历史 / 可花输出 / 广播 | **LWS** | view key |
| 输出分布 / 环成员 | **公共 monerod** | 不交任何密钥 |

这样把最敏感的链上隐私决策（诱饵分布）从服务器手里拿回本地，且额外泄露可忽略——向节点请求的正是这个环本身，上链后本来就公开。

**仍需验证**：最终装配（`OutputWithDecoys::new` → `SignableTransaction::new` → `sign`）需要一个真实的 `WalletOutput`，而它在 crate 外没有公开构造函数，必须由真实扫描产出 —— **这一步需要有资金的钱包**；真实广播；wasm-bindgen 胶水层的体积增量；FCMP++ 分支能否同样编过。

### 旁证：`@spirobel/monero-wallet-api` **[实测 · npm v0.5.5 包内容]**

CCS 资助的浏览器钱包项目的底层库，MIT，2026-09-14 仍有提交。拆包结果：

- WASI 形态（`dist/wasm-processing/wasi.js`），wasm 以 JS 内嵌 **2.95 MB**
- 有 `io/indexedDB.js` 与 worker 入口（4 MB）→ 浏览器可用
- 有 `send-functionality/transactionBuilding.js` → 确实做交易构造
- `node-interaction/{json,binary}Endpoints` → **直连 monerod，本地扫架构**
- 依赖仅 `@noble/curves` + `@noble/hashes`；submodule 挂 serai fork

**不建议直接采用**：它的 API 是 `openWallets({ scan_settings_path: "./ScanSettings.json" })`，面向 Node/Bun 服务端扫描器；且体积比直接用 monero-oxide 大一个数量级。**值得读它的打包方式与 `transactionBuilding`，不值得包它那层壳。**

**建议**：直接用 monero-oxide 编，crypto 层用薄接口隔开。**不要引入仓库里那份停更的 mymonero WASM 做脚手架** —— 它没有 FCMP++ 路径，且会让上层照着它的 API 形状写死。

## 1.5 工作量拆解（与 Zcash 对比）

LWS 模式最大的工程收益是：**不需要本地钱包数据库**。

| 模块 | Zcash（本地扫）实际付出 | XMR（LWS）需要付出 |
|---|---|---|
| 链数据获取 | compact block 拉取 + 批次调度 + lane 预算 | **LWS REST 客户端（纯 HTTP）** |
| 扫描 | 自写 `scan_blocks_inline`（上游 rayon 在 wasm 死锁） | **无** |
| 钱包数据库 | `zcash_client_sqlite` 编进 wasm32 + IndexedDB VFS + 44 表迁移 | **无**（账本状态在服务器） |
| 存储持久化 | OPFS / IndexedDB，清缓存重建闭环 | 仅 key image 缓存 |
| 密钥 + 交易构造 | Rust runtime | **要选型 + 编 WASM ← 唯一真未知** |
| 载体（三端） | webembed / offscreen / worker | 同样需要，但压力小得多 |

**Zcash 最难啃的几块全部来自「本地要维护钱包库 + 扫描状态」，LWS 模式下整块不存在。**

## 1.6 必须让产品知道的两条隐私代价

**（1）view key 交出去 = 全部收款历史，且不可轮换**

monero-lws 自带的非正式审计（j-berman，2022，CCS 提案的一部分）原文 **[一手]**：

> "If a `monero-lws` instance is compromised, user funds are still SAFU since the private spend key is never sent to `monero-lws`."

> "A user should assume that someone with access to wherever the `monero-lws` backend is hosted will be able to determine **all outputs received** to the user, and **in most cases today, the outputs spent by the user as well**. This also includes **amounts**."

实现层面三条事实 **[一手 · 源码]**：
- `src/db/data.h:188` —— `view_key key; //!< Doubles as authorization handle for REST API`，**view key 本身就是 API 凭据**
- `src/db/data.h:115` —— "row encryption not currently used"，**库里不加密**；路线图中的进程隔离未落地
- 该审计的威胁模型明确是「用户在只有自己能访问的机器上运行」，**不覆盖厂商为大量用户托管**

协议层事实：view key 对应整个账户（所有子地址由其派生），**不可轮换**。泄露一次 = 该钱包从创建到永远的收款历史被追溯解密。

**（2）诱饵选择被委托给服务器 —— 这是链上隐私风险，不只是"被看见"**

规范对 `get_random_outs` 的定义 **[一手]**：

> "Selects random outputs to use in a ring signature of a new transaction. If the `amount` is `0` then the `monerod` RPC `get_output_distribution` should be used to locally select outputs using a gamma distribution..."

即**环签名诱饵由服务器挑选后下发**。一台配置错误或恶意的服务器可以返回不符合分布的诱饵，使用户的**转出交易在链上被统计手段识别** —— 受益的是所有做链分析的人，且这种削弱是永久且公开的。与"用户自填服务器"叠加时尤其危险。

**缓解**：客户端自行向公共 monerod 请求输出分布、在本地选诱饵，不使用服务器的 `get_random_outs`。**FCMP++ 上线后环签名消失，此风险自动归零。**

## 1.7 运营决策：OneKey 自建 LWS（2026-09-17 定）

**决定：OneKey 自建并运营 LWS，同时保留用户自填。**

此前本节将「自填塌回自建」列为头号风险。该风险的实质**不是运营本身，而是"先宣称不运营、后在 deadline 前临时运营"** —— 那条路径下安全设计永远补不上。当前决策是**提前、显式地选择运营**，因此风险形态改变：从"失控地滑向运营"变为"有计划地运营"。

**但该决策只有在下述条件同时满足时才成立**（三条均为一票否决）：

| # | 条件 | 说明 |
|---|---|---|
| 1 | **安全设计与部署同批上线** | 不接受"先跑起来、安全后补"。清单见 §3.4 |
| 2 | **客户端必须可切换服务器** | 默认连我方，但一键可改为用户自建。若成为唯一选项，§1.6 的隐私代价将无从规避 |
| 3 | **诱饵不使用服务器的 `get_random_outs`** | 客户端自行向公共 monerod 取输出分布并本地选诱饵（已实测可行，见 §1.4） |

**仍然成立的风险**：我方将持有全体 XMR 用户的 view key —— 一份**不可轮换、可追溯全历史、可被传唤**的数据。§1.6 的全部结论继续适用，且该形态**没有任何已有的安全审计覆盖**（monero-lws 自带审计的威胁模型是"用户自建自用"）。

**运营方式、配置与安全清单见 §3.4。**

## 1.8 可行性结论

**可行，前提是三个条件同时成立：**

1. **合规侧放行** —— XMR 在多个交易所与司法辖区已被下架；此条可能否决整个项目，且不由工程决定；
2. **产品接受运营责任** —— 含 §1.7 的三条硬条件、§3.4 的安全清单，以及两条会影响用户承诺的技术约束（账户无法删除、mempool 不走 wallet API，见 §3.4）；
3. **完成最后一步技术验证** —— `OutputWithDecoys` → `SignableTransaction` → `sign` 的真实装配，需一枚有资金的钱包（自建 testnet/regtest LWS 即可满足，见 §3.4）。

前两条为非技术决策；第三条在自建测试环境后即可完成。

---

# 第二部分：XMR 本地扫比 Zcash 难多少

## 2.1 量化模型：把结构性差距与活动量快照分开

「Monero 比 Zcash 难多少」不能用单一倍数回答，因为其中混了一个**会随时间变化的快照量**。本节把成本拆成可分离的三项并分别测量。

### 模型

```
每日扫描带宽 = (交易数/天) × (候选 output/笔) × (字节/候选)
                    A              c                b
```

| 项 | Monero | Zcash | 倍数 | 性质 |
|---|---:|---:|---:|---|
| **A** 交易数/天 | 26,800 | 14,389 | 1.86× | **快照** |
| **c** 候选 output/笔 | 2.09 | 0.62 | **3.39×** | **结构**（有无透明池） |
| **b** 字节/候选 | 241 B | 116 B | **2.08×** | **结构**（有无精简块协议） |
| 候选总数/天 | 56,012 | 8,860 | 6.32× | |
| **带宽/天** | **13.50 MB** | **1.03 MB** | **13.1×** | |

模型算得 13.1×，与直接实测的 13× 吻合 —— **模型闭合**。

**数据来源**：Monero 的 `A` 来自近 5000 块实测（37.2 tx/块 × 720 块/天），`c` 来自 79 笔真实交易采样，带宽来自裁剪块实测；Zcash 的 `A` 来自区块浏览器（12.6 tx/块 × 1142 块/天），每块 compact 数据 900 B 来自 2026-09-16 安卓真机实测，`b`=116 B 为协议定义（`cmu` 32 + `epk` 32 + 密文前 52）。

### 归一化指标（与链上活跃度无关）

把活动量除掉，得到可长期引用的结构性指标：

| 归一化指标 | Monero | Zcash | 倍数 |
|---|---:|---:|---:|
| **每笔链上交易的扫描带宽** | **504 B/笔** | **72 B/笔** | **7.0×** |
| **每笔链上交易的试解密次数** | **2.09 次** | **0.62 次** | **3.4×** |
| **单次试解密的密码学成本** | — | — | **≈ 1.0×**（Zcash 略重，见 §2.4） |

### 敏感性：结构性倍数不依赖任何推导假设

模型中唯一的推导量是 Zcash 的 `b`=116 B。改变该假设：

| 假设每 output | 推得屏蔽 out/块 | 结构性倍数 |
|---|---|---|
| 100 B | 9.0 | **7.1×** |
| 116 B | 7.8 | **7.1×** |
| 150 B | 6.0 | **7.1×** |
| 200 B | 4.5 | **7.1×** |

**完全不变。** 该参数同时出现在覆盖率与字节数中，代数上相消：

```
结构性 = (2.09 ÷ (900/b ÷ 12.6)) × (241 / b) = 2.09 × 12.6 × 241 / 900     ← b 消失
```

因此 7.0× 仅依赖四个**直接实测量**：Monero 的 2.09 输出/笔与 13.5 MB/天，Zcash 的 900 B/块与 12.6 笔/块。

### 为什么绝对倍数必须标日期

活动量（`A`）是快照，会显著漂移。Monero 自身近五年实测：

| 时点 | 平均块重 | tx/块 | 裁剪后带宽 |
|---|---:|---:|---:|
| 5 年前 | 62.1 KB | 30.7 | 8.9 MB/天 |
| 3 年前 | 62.7 KB | 24.3 | 9.0 MB/天 |
| 2 年前 | 118.8 KB | 43.4 | 17.1 MB/天 |
| 1 年前 | 122.1 KB | 42.9 | 17.6 MB/天 |
| 3 个月前 | 100.6 KB | 39.7 | 14.5 MB/天 |

**Monero 自己五年内就变动约 2 倍**；Zcash 的 2022 垃圾墙区间更是正常区的 139–318 倍。两链活动量之比不是常数，**"13×" 只能作为 2026-09 的快照引用**。

### 回补量（同窗口）

| | Monero | Zcash |
|---|---|---|
| 回补到 2022-05（Orchard 激活同窗口） | ≈ 21 GB | ≈ 1.6 GB |

> 边界：Zcash 数据取自 2026 年正常区（3.28M–3.30M）。**2022 垃圾区（1,710,000–1,960,000）为 49–113 KB/块，密度高得多，不可外推。**

## 2.2 Zcash 侧的实测基准（这是我们唯一有真机数据的一侧）

**[实测 2026-09-16 · P0110 / Android 16 / arm64 / 15.4 GB RAM]**

| 项 | 实测值 |
|---|---|
| 扫描速率（1 UFVK） | **52.4 块/秒**（19.1 ms/块） |
| 扫描速率（4 UFVK） | **18.3 块/秒**（次线性：4 倍 key 只换 2.86 倍代价） |
| wasm 运行时内存 | 295–390 MB，扫 9,000 块净增长为零 |
| 本地扫描库 | 10.6 MB / 9 万块 |
| 对链尖余量 | 1 UFVK 3900×，4 UFVK 1373× |

**推导 [估算 · 基于上述实测速率]**：从 Orchard 激活（1,687,104）回补到当前链尖（3,485,289），共 1,797,049 块：

- 1 UFVK ≈ **9.5 小时**
- 4 UFVK ≈ **27.3 小时**
- 流量 ≈ **1.6 GB**（正常区速率；穿过 2022 垃圾区会显著更高）

**关键判断（来自实测）**：追不上链尖在任何跑得起 app 的 Android 上都不会发生（余量 1000 倍以上）。**真问题是首扫等待时长，而首扫必须前台。**

## 2.3 Monero 侧：只能估算，且必须说明为什么

**没有可测的对象**。市面上不存在 Monero 的 WASM 扫描器 —— 唯一有 WASM 产物的 mymonero 加密栈是 LWS 客户端，不含扫描器。所以下面的数字全部是 **[估算]**：

| 回补范围 | 交易数 | 纯标量乘 CPU（WASM 单线程） | 下载量 [实测速率推导] |
|---|---|---|---|
| 1 年 | ≈ 980 万笔 | 20–40 分钟 | 4.9 GB |
| 全链（2014 至今） | ≈ 6386 万笔 | 2.5–5 小时 | ≈ 25 GB |

推导依据：每笔交易至少一次 Ed25519 变基标量乘；WASM 较原生慢 2–3 倍；未计入解析、存储与树维护开销，**实际只会更高**。

## 2.4 单个 output 的密码学成本：两边其实差不多

这一点容易被误判 —— **Zcash 的密码学并不更便宜**：

| | Monero | Zcash（Orchard） |
|---|---|---|
| 试解密核心 | `D = 8·a·R`，Ed25519 变基标量乘 | `[ivk]·epk`，Pallas 变基标量乘 |
| 能否在交易内摊销 | 同一 tx pubkey 下多 output 共用一次；**用子地址时不成立** | **不能**，每个 output 自带 epk |
| 快速过滤 | **view tag**（1 字节，滤掉 255/256 的后续工作） | 无等价物 |
| 额外结构开销 | 今天没有承诺树 | **note commitment tree + witness 维护**（Sinsemilla，EC 运算） |

逐个 output 比，Zcash 因为多一层树维护反而更重。**差距来自候选集规模，不是单次成本。**

## 2.5 结构性差距（不需要测量就成立）

这四条才是「难多少」的真正答案：

| # | 差异 | Monero | Zcash |
|---|---|---|---|
| 1 | **透明泄压阀** | 无。**100% 的交易必须试解密** | 有。只需扫屏蔽部分，大头是透明交易 |
| 2 | **精简块协议** | 无。只有 `getblocks.bin`，最省也要拉完整交易前缀 | **有**。compact block 只含 cmu/cmx + epk + 密文前 52 字节 |
| 3 | **钱包起始高度** | **助记词不携带 birthday**，导入旧钱包无法确定起点，默认只能往更早扫 | 有 birthday |
| 4 | **端侧先例** | 插件端零；移动端 LWS 有 Edge/Skylight，但都是原生模块 | 官方 Rust SDK，我们已编出 wasm32 |

第 1、2 条是协议层设计，**工程优化改不掉**。这也解释了两个生态为何朝相反方向演化：

- **Zcash** 造了 compact block + lightwalletd，把本地扫做便宜 → 因而**没有**交付 viewing key 的服务端标准
- **Monero** 既无泄压阀也无精简块协议，本地扫便宜不了 → 因而长出了 **LWS 规范与生态**

## 2.6 对 OneKey 的两个乘数

**（1）四个端 = 四份扫描。** 钱包缓存是解密后的票据数据，天然每设备独立；跨端同步这份缓存要么交给服务器（隐私失效），要么做设备间同步（无此机制）。一个用户装桌面 + 移动 + 插件 = 三份完整扫描。

市面上没有先例 —— Cake、Monerujo、Feather 的用户基本只在单一端使用 XMR。

> **对照：LWS 模式下服务端扫描进度按账户存，四个端共享同一份状态，只等一次。** 这正是该乘数的解药。

**（2）移动端只能前台扫。** 运行时位于 WebView 内，应用进入后台后定时器与网络被挂起（已实测）。

> **未验证的逃生门**：Android 前台服务（`FOREGROUND_SERVICE_DATA_SYNC` + 通知栏进度条）是 Skylight/Cake/Monerujo 的标准做法。它能解决**进程层**（App 被冻结、网络被切），但**能否解决 WebView 层的 Chromium 隐藏页节流是开放问题** —— 那几家的扫描都在原生代码里，不在 WebView 里。我们此前的"后台全暂停"观测是在**没有前台服务**的情况下取得的。
>
> 这个 spike 对 XMR 价值不大（LWS 不在设备上扫），但**对 Zcash 有直接价值**：若能走通，Zcash Android 可后台同步。iOS 无等价物。

## 2.7 「高多少」：该报哪个数

| 说法 | 数值 | 能否长期引用 |
|---|---|---|
| **每笔交易的扫描带宽比** | **7.0×** | ✅ 结构性，仅随协议变化 |
| **每笔交易的试解密次数比** | **3.4×** | ✅ 结构性 |
| **单次试解密的密码学成本比** | **≈ 1.0×**（Zcash 略重） | ✅ 结构性 |
| 当前绝对带宽比 | 13× | ⚠️ **必须标日期**，含 1.86× 的活动量因子 |
| Monero 侧扫描 CPU 总量 | **无法给出可信倍数** | ❌ 无可测对象 |

**不要对外说「Monero 比 Zcash 慢 N 倍」** —— Monero 侧没有真机扫描数据，且绝对倍数含快照成分。

**推荐对外表述：**

> 归一化到每笔链上交易，Monero 的客户端扫描带宽是 Zcash 的 **7 倍**、试解密次数是 **3.4 倍**，而**单次解密的密码学成本两者相当**。差距来自两条协议层设计 —— Monero 没有透明池（每笔交易都必须试解密）、也没有精简块协议（每个候选多下约 2 倍字节），**与当下链上活跃度无关**。

**误读提示**：7.0× 描述的是**数据量**，不是密码学强度。常见误解是把它读成「XMR 加密更难」——§2.4 的分析结论相反：逐个候选看，两边都是「一次变基标量乘 + 廉价失败路径」，Zcash 因多一层承诺树维护反而略重。

**未量化的两项**（方向相反，故未并入倍数）：Zcash 的承诺树维护成本会**缩小**差距；Monero 助记词无 birthday 导致的扫描范围劣势会**扩大**差距。

**已知偏差**：Monero 的 241 B/候选由日带宽反推，含区块头与 coinbase 分摊，高于纯交易前缀（实测 395 B/笔 ÷ 2.09 ≈ 189 B）。据此 **7.0× 略偏高，真值约在 5.5–7.0 之间**。

---

# 第三部分：实施方案

## 3.1 LWS 方案（已选）：前后端与选型

**后端：我方自建**（部署与运营见 §3.4），同时保留用户自填。客户端对两者一视同仁 —— 服务器地址是可配置项，不是硬编码。

**前端五层：**

| 层 | 选型 | 依据 |
|---|---|---|
| LWS REST 客户端 | **自写**，约 300 行 TS | 契约在 `monero-project/meta`；旧代码 `helper.ts` 已实现一半；npm 的 `@mymonero/mymonero-lws-client` 停在 2024-07 且无 `get_tree_paths` |
| 加密 + 交易构造 | **`monero-oxide/monero-wallet` → wasm32** | 实测 226 KB / 21 秒编过；MIT；与 FCMP++ 同源（见 §1.4） |
| 诱饵数据源 | **自实现 `ProvidesDecoys`**，接公共 monerod | 已对主网实跑通过；规避 §1.6（2）的链上隐私风险 |
| 四端载体 | **复用 Zcash 现有通道** | Worker / offscreen / web-embed 已建成并验证 |
| 本地存储 | 仅 key image 缓存 | 账本状态在服务器，**不需要钱包数据库** |

**数据流（方案的核心）：**

```
余额 / 历史 / 可花输出 / 广播   →   用户的 LWS        （交出 view key）
输出分布 / 环成员               →   公共 monerod      （不交任何密钥）
构造 + 签名                     →   本地 wasm         （spend key 不出设备）
```

四端完全一致：wasm 与 HTTP 均平台无关。

**载体现状（复用对象，均已验证）：**

| 端 | 链路 | 隔离层级 |
|---|---|---|
| Web | 主线程 → 专用 Worker | 线程 |
| Desktop | 同 Web（`index.desktop.ts` 仅一行 re-export） | 线程 |
| Extension | MV3 bg → offscreen document → 同一 Worker | 文档 + 线程 |
| iOS / Android | bg（Hermes 不能跑 wasm）→ web-embed WebView → inline Worker | 进程 + WebView + 线程 |

运行时为**单线程 wasm**，不需要 `crossOriginIsolated`。LWS 模式下 wasm 仅在**发送时**运行一次（构造 + CLSAG + Bulletproofs+，秒级），单线程足够。

## 3.2 扫链方案（备选）：选型与真实成本

**后端：无**（直连公共 monerod）或自建节点。

### monero-oxide 对扫链路线的覆盖度 **[一手 · 源码核实 2026-09-17]**

`MoneroDaemon<T: HttpTransport>` 已实现全部六个数据源 trait：

```
ProvidesBlockchainMeta
ProvidesUnvalidatedBlockchain          → ProvidesBlockchain
ProvidesUnvalidatedDecoys              → ProvidesDecoys
ProvidesUnvalidatedOutputs             → ProvidesOutputs
ProvidesUnvalidatedScannableBlocks     → ProvidesScannableBlocks
PublishTransaction
```

`HttpTransport` 仅含**一个方法**：

```rust
fn post(&self, route: &str, body: Vec<u8>, response_size_limit: Option<usize>)
  -> impl Send + Future<Output = Result<Vec<u8>, InterfaceError>>;
```

即 `post(路由, 字节) -> 字节`，可用浏览器 `fetch` 直接实现。`monero-daemon` 的依赖全部为 `default-features = false`，**不绑定 tokio 或 reqwest**。

**二进制 RPC 与 epee 解析已由上游提供**（`interface/daemon/src/bin_rpc/`）：

| 文件 | 覆盖 |
|---|---|
| `blocks_bin.rs` | `get_blocks.bin` |
| `mod.rs` | `get_outs.bin`、`get_o_indexes.bin`、`get_output_distribution.bin` |
| `epee.rs` + 独立 `monero-epee` crate（no_std） | epee 解析 |

`ExpandToScannableBlock` 的默认实现还处理了 output index 追踪，且其注释写明这是**出于隐私考虑的设计**——只请求每块首个 RingCT output 的索引，其余本地推算，避免为每个扫到的 output 单独发请求。

### 修正：此前对本方案的成本估计偏高

本节早先版本称扫链方案需「自解 epee 二进制」并「自行从 `getblocks.bin` 组装 `ScannableBlock`」。**两项均不成立** —— 上游已覆盖。

### 两条路线的真实差异

| 层 | LWS 方案 | 扫链方案 |
|---|---|---|
| 链数据获取 | **自写 REST 客户端** | ✅ 上游全包（含 epee + 二进制 RPC） |
| 诱饵 | **自写**（LWS 无 output distribution 端点） | ✅ 上游全包 |
| 扫描 | 不需要 | ✅ `Scanner` 现成 |
| 广播 | LWS `submit_raw_tx` | ✅ `PublishTransaction` 现成 |
| **钱包数据库** | **不需要**（账本状态在服务器） | ❌ **自建** ← 主要工程成本 |
| 四端载体 | 复用 Zcash | 复用 Zcash |
| 移动端后台 | 不需要 | ❌ 前台限制（§2.6） |

**反直觉结论：论库支持度，扫链方案比 LWS 方案更完整。** LWS 路线需自写 REST 客户端与诱饵接入，扫链路线这两块上游全部提供。

**因此排除扫链方案的理由需要更换表述**：不是「没有可用的库」，而是

1. **钱包数据库需自建** —— Monero 无 `zcash_client_sqlite` 的对应物；
2. **四端产品形态约束** —— 每端各扫一遍、移动端只能前台（第二部分结论不变）。

### 替代路线

`monero-ts`（wallet2 WASM，5.93 MB）可直接扫描，但 FCMP++ 后 wallet2 将链接 Rust 静态库，emscripten 重建难度显著上升，且为单人项目。

## 3.3 准备度盘点

**已确定（有实测支撑）：**

| 项 | 状态 |
|---|---|
| 架构分层 | ✅ |
| 库选型 | ✅ |
| 四端载体 | ✅ 复用 Zcash，已验证 |
| wasm 可行性与体积 | ✅ 226 KB **[实测]** |
| 诱饵数据源 | ✅ 主网实跑 **[实测]** |

**未确定：**

| # | 项 | 性质 | 阻塞什么 |
|---|---|---|---|
| 1 | **合规** —— XMR 的下架与监管状况 | 非技术，法务裁定 | 可否决整个项目 |
| 2 | **运营责任的正式承接** —— §1.7 三条硬条件 + §3.4 安全清单是否被接受 | 非技术，产品裁定 | 决定自建能否成立 |
| 3 | **账户删除承诺** —— LWS 不支持删除账户（§3.4.4a） | 技术+法务 | 阻塞隐私政策撰写 |
| 4 | **最后一步技术验证** —— `OutputWithDecoys` → `SignableTransaction` → `sign` 的真实装配 | 技术 | 自建 testnet 实例后即可完成 |

**已解决（2026-09-17）**：产品形态问题（原为「必须填服务器 vs 给可换默认」）已由 §1.7 的运营决策回答 —— **默认连我方实例，同时保留用户自填**。

## 3.4 自建 LWS：部署与运营

本节为 §1.7 决策的落地细节。**全部配置项与限制均来自 monero-lws 官方文档与源码选项表 [一手]。**

### 3.4.1 组件与规格

| 组件 | 说明 |
|---|---|
| `monerod` | 全节点或裁剪节点，**必须开 `--zmq-pub`** |
| `monero-lws-daemon` | REST 服务 + 扫描器 |
| `monero-lws-admin` | CLI，仅装于运维机；**创建管理员账户只能经由它**（官方出于安全不开放此命令的 REST 接口） |

| 规格项 | 数值 |
|---|---|
| monerod 全节点 | **≈ 280 GB**（Monero 官方 README，2026-06） |
| monerod 裁剪节点 | **≈ 95 GB** |
| LWS 的 LMDB | 另计，随账户数增长 |

镜像：**锁定具体的 `v1.0.x` tag**，或用不带版本号的稳定 tag `ghcr.io/vtnerd/monero-lws`。**不要用 `:master`**（该分支官方自述 alpha）。

> 文档滞后：README 的 "Supported Releases" 仍只列 `0` 与 `0.3`，**尚未跟上 2026-09-09 的 v1.0.0**。以 tag 为准。

> **待验证**：monero-lws 文档未说明是否支持裁剪节点。理论上可行（裁剪移除的是环签名数据，输出本身保留，而扫描只需交易前缀），但**无文档背书，不要直接按 95 GB 做容量规划**。

### 3.4.2 必须改的默认值

以下默认值会直接导致产品不可用或不安全：

| 配置 | 默认 | 必须 | 原因 |
|---|---|---|---|
| `--max-subaddresses` | **0 = 子地址全禁** | 非零 | **Monero 钱包依赖子地址收款**。官方警告：一旦启用应永远保持启用，改回 0 会连既有子地址一并失效 |
| `--access-control-origin` | 无 | **必须配置** | 插件/Web 为浏览器客户端，**无 CORS 则完全不可用**。Zcash 侧已在 lightwalletd 上踩过同类问题 |
| `--auto-accept-creation` | 关（需人工批准） | 开 | 否则每个新用户均需运维手动授权 |
| `--auto-accept-import` | 关 | 按策略 | 「从创世重扫」是 CPU 攻击面，不应无条件开放 |
| `--create-queue-max` | — | 设上限 | 防止刷账户 |
| `--rest-ssl-key` / `--rest-ssl-certificate` | **每次启动生成新的自签证书** | 使用真实证书 | 默认行为在生产环境不可用 |
| `--sub`（配 monerod `--zmq-pub`） | 无 → **20 秒轮询** | 配置 | 即时出块通知 |
| `--disable-admin-auth` | 关 | **永不开启** | |
| 汇率 API | **默认关** | 保持关闭 | 开启即形成对第三方的外泄点 |

### 3.4.3 扩展性：成本按「账户 × 块数」增长

LWS **按账户扫描**，不是扫一遍供所有人共享（§1.3）。默认的 round-robin 会让一个补扫旧钱包的新账户拖慢同线程上其他账户的日常同步 —— 官方文档原文：*"some accounts are stuck waiting for the old accounts to catch-up"*。

**建议开启**：`--block-depth-threading` + `--split-sync-threads`（隔离"已同步"与"回填中"账户）+ `--balance-new-addresses`；`--scan-threads` 按核数配置。

### 3.4.4 两条影响用户承诺的硬约束

**（a）账户无法删除。** admin 文档原文：

> "Deleting accounts is not currently supported."

仅能改为 `inactive`。这与「删除钱包即删除服务端数据」的承诺直接冲突。三条出路：修改承诺、自行编写脚本直接操作 LMDB（有风险）、向上游提需求。**必须在撰写隐私政策之前解决**，否则会写出一条做不到的承诺。

**（b）mempool 不经 wallet API。** daemon 文档原文：wallet API **NOT** report mempool transactions；仅 webhook 可报 0-conf。

因此「收款即时显示」必须依赖 webhook 推送，**不能靠轮询 `get_address_info`** —— 这会影响客户端架构设计。

### 3.4.5 安全清单（与部署同批上线，不接受后补）

| 项 | 做法 |
|---|---|
| view key 是 API 凭据且 LMDB 不加密（§1.6） | 全盘加密 + 严格访问控制；**备份同样必须加密** |
| 身份关联 | 不记录 IP；**不存储 view key ↔ OneKey 账号的映射** |
| 广播路径 | `submit_raw_tx` 与查询走不同出口，避免将转出交易与账户关联 |
| 诱饵 | **客户端自行选择**（已实测可行），不使用服务器的 `get_random_outs` |
| 网络 | 提供 onion 端点 |
| 可切换 | 默认连我方，**一键可改为用户自建** —— §1.7 的硬条件之一 |
| 进程隔离 | upstream 路线图项，**尚未落地**；在其到位前以部署层隔离补偿 |

### 3.4.6 推进顺序

1. **先起 testnet / regtest 实例** —— 同时解决 §1.8 第 3 条：testnet 币免费，可完成 `OutputWithDecoys → SignableTransaction → sign` 的真实装配验证；
2. 再评估主网运营的安全与合规；
3. 主网上线时，**客户端须同时具备切换服务器的能力**。

---

## 附：证据与限制

**本文已做的事**：编译并运行了 Monero 代码 —— `monero-oxide/monero-wallet` 编到 `wasm32-unknown-unknown` 并测量产物；自写 `ProvidesUnvalidatedDecoys` 实现，对**主网**只读实跑（输出分布通过上游校验、取回 16/16 合法环成员）；拆解 `@spirobel/monero-wallet-api` npm 包；对主网区块与交易采样。

**本文未做的事**：**未连接任何 LWS**、未创建 XMR 钱包、**未收发或广播任何一笔 XMR 交易**、未完成 `SignableTransaction` 的真实装配（需有资金钱包）。Monero 侧的**扫描 CPU 数字**仍全部为估算 —— 不存在可测的 Monero WASM 扫描器。

**一手来源**

| 来源 | 用于 |
|---|---|
| `monero-project/meta` · `api/lightwallet_rest.md` | 端点契约、诱饵选择定义、候选花费语义 |
| `vtnerd/monero-lws` · README / `docs/review_02.03.22/` / `src/db/data.h` / `docs/apps/{daemon,admin}.md` / `docs/scan/*` / `src/server_main.cpp` 选项表 / CARROT 分支 | 服务端能力、审计原文、view key 存储方式、**部署配置项与默认值、账户删除限制、mempool 限制** |
| `ccs.getmonero.org` · vtnerd 系列提案 | 资助连续性与工作范围 |
| `monero-project/monero` · `src/wallet/wallet2.cpp` / `src/fcmp_pp/fcmp_pp_rust/Cargo.toml` / fcmp++ 里程碑 | 裁剪块请求、FCMP++ 是 Rust 且依赖 monero-oxide |
| `MrCyjaneK/monero_c` · `build_single.sh` | 构建目标无 wasm |
| `monero-oxide` · `wallet/src/{scan,decoys,send}.rs`、`interface/src/provides_*.rs`、`interface/daemon/src/{lib,blocks,bin_rpc/*}.rs`、`epee/` | wasm32 编译与体积实测；`ProvidesDecoys` 集成验证；**`MoneroDaemon` 的 trait 覆盖度与 epee/二进制 RPC 支持** |
| `MAGICGrants/skylight-wallet` · `.gitmodules` / AndroidManifest | 纯 LWS 钱包仍需原生加密栈；前台服务用法 |
| 公共 Monero 节点只读 RPC（2026-09-11 / 09-15 / 09-17） | 链高、区块权重、裁剪比例、每笔输出数采样（79 笔）、输出分布、环成员、**近五年区块密度历史采样** |
| Zcash 区块浏览器 API（2026-09-17） | 每块交易数 12.6、链高 3,485,289 |
| 本机编译与实跑（rustc 1.98.1，2026-09-16/17） | `monero-wallet` wasm32 产物体积；`ProvidesDecoys` 对主网的集成验证 |
| `api.blockchair.com/zcash/stats`（2026-09-16） | Zcash 链高 3,485,289 |

**本仓库内部来源**

| 来源 | 用于 |
|---|---|
| `packages/core/src/chains/xmr/sdkXmr/helper.ts` | 旧代码即 LWS 客户端 |
| `packages/shared/src/config/zcash.ts` | Orchard 激活高度、2022 垃圾区范围 |
| `app-modules/chain-runtimes/zcash/README.md` | Zcash runtime 已验证项 |
| 2026-09-16 安卓真机扫描实测 | Zcash 扫描速率、内存、流量、库大小 |

**相关文档**

- `development/research/xmr-cross-platform-runtime-evaluation.md`（2026-09-05）—— **框架已过时**：该文假设的问题是「本地扫用哪个 runtime」，与现已定的 LWS-only 方向不一致；其中的 `monero_c` 体积测量与 `monero-ts` 评估仍然有效。
