# Zcash 生产就绪独立审查 — 2026-09-06

## 修复跟进

用户确认本地 portal/CI 依赖属于已知开发配置，本轮不修改该项。下文保留原始审查证据与评分，不代表修复后的重新评级。

- 已修复池级历史：Runtime 返回 `perPoolBalanceDeltaZat`；App 按所选池克隆投影金额/方向，保留透明池、未来池 ID 和净零记录，不修改聚合缓存。
- 已修复 alias 删除：仅仍启用或存在启停操作的同 UFVK 账户保留共享缓存；其余账户稳定关闭时执行 purge。
- 已修复重扫金额误导：手续费未知的外发记录在列表、表格、详情显示本地化不可用占位，池级视图仍显示真实净变化。没有新增 transaction enhancement，手续费本身仍可能未知，也没有新增隐私历史持久化副本。
- 修复回归：Rust lib 29 项通过；App 金额/投影 33 项、alias 删除及服务 10 项通过；跨代理复核已完成。
- 统一检查的 lint、格式、后台接口契约均通过；首次全仓类型检查发现新增测试 fixture 的枚举类型错误，修正后重跑 `yarn tsc:staged` 通过。
- Runtime release WASM 已重新生成，SHA-256 为 `76196c97263777775a431b840363c44aceeaca0236fb1ead0958803aac9375d2`，JS glue 同批输出。App portal 指向该产物；已运行的 App/bundle 仍需重新构建或重新加载。
- 本轮未执行真实资金或四端实机闭环，生产验收边界仍适用。

## 审查概要

- **结论：当前不满足生产发布条件，需修复后复审。** 确认 2 个 P1、2 个 P2，另有发布与实机验证缺口。
- GPT 6 负责范围、反证、去重与结论；三个 GPT 5.6 子代理分别负责资金链路、架构与生命周期、跨平台与发布。子代理未继承此前对话和审查结论。
- 范围：当前 App Zcash 实现、相关通用接入点，以及上级 `onekey-zcash-runtime` 当前磁盘源码；包含未提交和未跟踪文件。App HEAD 为 `374d620ef8c26e92113143331cd5dee8f29f36dc`，分支 `feat/zcash-integration`。Runtime 没有 HEAD。
- 范围统计仅作定位：App 已提交分支相对本地 `origin/x` 为 152 文件、+17,528/-61；工作区 tracked diff 为 112 文件、+6,665/-2,962。这两个范围重叠且包含非 Zcash 改动，不代表逐行审查全部文件。
- 验收依据：`packages/kit-bg/src/vaults/impls/zcash/docs/08-privacy-mode-requirements-and-acceptance.md`。旧验收文档仅作历史证据，过期 Sapling 描述不作为当前要求。
- 涉及平台：iOS、Android、Extension MV3、Desktop、Web。
- Codex 交叉验证：已启用，GPT 5.6 独立审查与交叉质疑。
- PR 评论分析：不适用；本次为本地生产就绪审查，没有指定 PR，也没有发布远程评论。
- 本轮未修改生产代码，未执行真实交易，未读取真实密钥。

## 评分

| 维度 | 得分 | 说明 |
| --- | --- | --- |
| 安全性 | 8/10 | 已检查路径中的源池限制、输入锁、未知广播保护较完整；未发现可证实的密钥泄漏或错误源池花费。不能替代独立密码学审计。 |
| 代码质量 | 5/10 | 存在确定的跨池金额展示错误及重扫前后金额变化。 |
| 架构合理性 | 7/10 | App 意图、Runtime 扫描与私有交易、stateless keys 签名职责基本清晰；历史投影丢失了池级信息。 |
| 完整性 | 4/10 | 发布依赖、删除语义、重扫金额与真实跨端闭环尚未完成。 |
| **加权总分** | **6.3/10** | **需修改后复审。评分不能覆盖下列发布阻断。** |

## Codex 交叉验证摘要

| 发现 | 资金审查 | 生命周期审查 | 平台审查 | 统筹核实 |
| --- | --- | --- | --- | --- |
| 跨池历史使用整笔金额 | 发现 | 确认 | 确认 | 核对 SDK、历史 action 与 UI 过滤链 |
| 已关闭 alias 阻止删除缓存 | — | 发现 | 确认 | 核对 purge 条件与删除返回路径 |
| 发布依赖指向本机 sibling portal | — | — | 发现 | 核对 package、workflow、Runtime 无 HEAD |
| 重扫后手续费未知导致金额变化 | 确认 | — | — | 核对 SDK fee-known 分支与现有限制 |

## 发现的问题

### [P1] [🔵 High] 发布依赖无法在干净 CI 中解析

**文件：** `packages/core/package.json:59`；`.github/workflows/release-app-bundles.yml:183`、`:224`。

`onekey-zcash-keys` 和 `onekey-zcash-runtime` 依赖分别指向 `portal:../../../onekey-zcash-runtime/pkg-keys` 和 `portal:../../../onekey-zcash-runtime/pkg`。发布工作流检出 App 仓库后执行 `yarn install --immutable`，没有准备这个 sibling 仓库或对应包的步骤。干净 runner 缺少 portal 目标，无法完成依赖安装。当前 Runtime 本身也没有 Git HEAD，无法固定审核过的版本。

**影响：** 阻断干净环境发布构建。本机存在目录、已有 node_modules 或已有构建产物，均不能证明 CI 可复现。

**修复建议：** 固定 Runtime 源码版本，将 keys/runtime 发布为可追溯的包并更新锁文件，或让 CI 按固定 SHA 准备并构建依赖。验证干净 checkout 安装与构建。此项是开发到发布的工程门槛，不是资金漏洞。

### [P1] [🔵 High] 跨池历史显示整笔账户金额，没有投影各池 delta

**文件：** `../onekey-zcash-runtime/crates/zcash-runtime/src/history.rs:74`；`packages/core/src/chains/zcash/sdkZcash/impl/wallet.ts:697`；`packages/kit-bg/src/vaults/impls/zcash/localHistory.ts:98`；`packages/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsHistory.tsx:251`。

Runtime 返回账户级 `totalSpentZat`、`totalReceivedZat` 与触及的 `poolIds`。SDK 计算一个 `valueZat`，历史层生成一个 transfer amount，UI 最后只按池过滤，没有重算该池金额和方向。

**例子：** 用抽象单位说明：同账户 Orchard 花费 100，Ironwood 收到 99，差额为手续费。池视图应分别表达 Orchard 支出 100、Ironwood 收入 99。当前两页复用同一笔内部转移 action 和金额 99。数字仅说明守恒关系，不是实际手续费报价。

**影响：** 真实跨池交易可以合理地出现在两个池页，但当前无法解释各池实际余额变化。这与当前验收合同的 pool delta 要求冲突。

**修复建议：** Runtime 按账户拥有的输入与输出分池返回 received/spent/delta；SDK 保留池级信息；具体池页面按所选池构建金额和方向。聚合交易金额与池级 delta 分别保留。补一笔跨池且输入/输出金额不同的端到端投影测试。

### [P2] [🔵 High] 已关闭的同 UFVK alias 会静默阻止隐私缓存删除

**文件：** `packages/kit-bg/src/vaults/impls/zcash/Vault.ts:1156`；`packages/kit-bg/src/services/ServiceZcash.ts:289`；`packages/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsZcashPoolBlock.tsx:826`。

**触发：** A、B 共享 UFVK，B 仍是 App 中的账户但隐私模式已关闭；用户删除 A 的本地隐私数据。

删除逻辑仅凭 B 的 DB account 仍存在，就将 `hasLiveAlias` 置为 true，跳过 Runtime purge；随后删除 A metadata 并成功返回。界面没有告知缓存被保留。GC 也不会补删，因为 B 是仍存在的账户。

**影响：** 本机解密 note/history 缓存静默留存。不是资金损失，但与明确的隐私数据删除预期不符。另一个 alias 仍启用时保留共享缓存是正确行为。

**修复建议：** 以启用状态及进行中的生命周期操作判断共享缓存引用；没有其他启用引用时删除 Runtime cache。若产品决定暂停账户也保留引用，则删除界面必须明确告知未删除的共享数据。测试 A 删除时 B 为 on、off、enable/disable 中间态的矩阵。

### [P2] [🔵 High] 重扫后同一外发交易金额会包含手续费

**文件：** `packages/core/src/chains/zcash/sdkZcash/impl/wallet.ts:701`；`../onekey-zcash-runtime/README.md:167`。

本地构造交易时手续费已知，显示金额排除手续费；缓存清除并重扫后，当前没有 transaction enhancement 恢复手续费，`feeZat` 可为 null，SDK 回退到包含手续费的账户 `balanceDelta`。

**例子：** 外发 60、手续费 1 的同一 txid，重扫前显示发送 60，重扫后可能显示 61 且手续费为空。数字为示意。

**影响：** 不改变链上资金，但历史对账口径随缓存状态变化。

**修复建议：** 在 Runtime 内补全可重建的交易信息，恢复 fee；或者在信息不足时明确显示“账户净变化/手续费未知”，不要继续将该值表达为已知的发送金额。继续维持 Runtime 为隐私历史的单一信源。

## 修改清单

| 优先级 | 置信度 | 范围 | 修改目标 | Auto-fix |
| --- | --- | --- | --- | --- |
| P1 | 🔵 High | Runtime 包、App 依赖、CI | 干净环境可复现安装和发布 | 需选择发布方式 |
| P1 | 🔵 High | Rust history → SDK → UI | 每池金额与方向正确 | 跨层变更，不提供局部伪修复 |
| P2 | 🔵 High | alias 删除与 UI | 删除结果与实际缓存一致 | 需明确共享引用语义 |
| P2 | 🔵 High | history fee 恢复/展示 | 重扫前后金额语义一致 | 需补全信息或明确未知状态 |

建议先完成上述明确修复，再复审；本轮证据不要求大规模增加抽象或重写 Runtime。

## 验证结果与测试建议

本轮实际执行的定向测试均通过。不同审查员有重叠测试，以下不合并成独立测试总数：

| 审查范围 | 本轮结果 | 证据边界 |
| --- | --- | --- |
| 资金：send、wallet、history、transparent mode | Jest 4 suites / 44 tests 通过 | 未覆盖各池 delta 与重扫金额不变性 |
| 生命周期：ServiceZcash、SimpleDbEntityZcash、Vault.transparentMode | Jest 3 suites / 28 tests 通过 | 未覆盖完整 alias 删除矩阵 |
| 平台：Desktop carrier、移动 RPC、ServiceZcash | Jest 6 suites / 53 tests 通过 | Worker、桥接及部分服务使用 mock |
| Runtime | `cargo test -p onekey-zcash-runtime --lib`，29 tests 通过 | 未执行真实链上或实机生命周期验证 |

已在代码中检查的关键保护：精确源池限制；quote/create 策略一致；透明签名前重验 UTXO；广播前持久化交易；私有 transaction/intent 原子写入与 durability barrier；unknown 保持 pending、恢复重播相同 txid；无法确认旧 writer 停止时保持 quarantine。

生产验收尚需补齐：

1. 修复项回归：跨池不等额投影；重扫前后同 txid 金额与手续费；同 UFVK alias 删除矩阵。
2. 使用固定 Runtime 版本进行干净 checkout 安装、release bundle 构建和启动。发布资产需要能追溯到源码与 JS glue/WASM 版本；现有 `apps/web-embed/scripts/check-zcash-bundle-boundary.js` 的 marker/体积检查不能证明这一点。
3. Extension、Desktop、iOS、Android 的真实 App 主网 Token/History、enable/catch-up、发送、Pending、重启、Confirmed 闭环，以及余额/手续费守恒。Web 补生产 bundle 启动与存储 smoke。旧 runtime testnet 示例不替代当前 App 验收。
4. 在 finalize 持久化、host journal 删除、广播等边界终止进程并恢复；确认原 txid、输入锁及广播状态。覆盖 MV3 service-worker 重启和移动 WebEmbed 生命周期。
5. Runtime 端点的明确网络身份检查、主网长历史/重组/大规模分页仍是验证缺口；本次未证明它们已导致错误签名或资金损失。

平台判断边界：iOS/Android 的 bg 与 main JS 堆隔离，bg 管理 mode/journal，main WebEmbed 拥有 WASM/IndexedDB；Extension 由 offscreen 拥有 WASM/存储；Desktop/Web 的 App main/bg 为单 JS runtime，Desktop 另有 Worker 资源。不能用 mock 或单 runtime 测试推导分离运行时的实机结果。

经反证排除：透明签名检查与隐私 reset 的时序窗口尚未证明会破坏独立的 t-to-t 交易，因此没有列为阻断；WASM 文件时间早于源码也不能单独证明产物失效，静态检查发现了关键新逻辑，保留的结论仅是来源验证不足。

## GH 评论操作

不适用。本次只交付本地审查报告，没有修改生产代码、创建 PR 或发送远程评论。
