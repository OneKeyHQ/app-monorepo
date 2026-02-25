# OneKey Monorepo 测试覆盖率提升计划

## 现状分析

### 整体数据

| 包 | 源文件数 | 测试文件数 | 覆盖率 | 状态 |
|---|---------|----------|--------|------|
| **core** | 307 | 42 | 13.68% | 相对最高 |
| **shared** | 559 | 16 | 2.86% | 低 |
| **kit-bg** | 834 | 4 | 0.48% | 严重不足 |
| **kit** | 2,623 | 5 | 0.19% | 严重不足 |

**全仓库共 67 个测试文件，整体覆盖率约 3-4%。**

### 测试基础设施现状

- **框架**: Jest 29.7.0 + SWC 编译器，覆盖率 provider: v8
- **移动端**: react-native-harness (Hermes 引擎真机测试) + Detox E2E
- **CI**: GitHub Actions — `unittest.yml`(PR 触发)、`harness-test.yml`(每日定时)
- **覆盖率追踪**: 未配置 — 无 `collectCoverageFrom`、无阈值门禁、无报告上传
- **共享测试工具**: 无 — 无 test factories、无 fixtures、无 helpers 包

### 已测试区域（优势）

- Core 加密/密钥管理: secret/BIP32/BIP39/AES256 (7 个测试)
- Core 区块链链实现: 27 条链的 CoreChainSoftware 测试
- Shared 工具函数: numberUtils, dateUtils, stringUtils 等 (16 个测试)

### 关键未测试区域（风险）

1. **Vault 签名层** (`kit-bg/src/vaults/`) — 347 文件，0 测试。签名逻辑是钱包核心安全层
2. **后台服务** (`kit-bg/src/services/`) — ServiceSend (25K 行)、ServiceSwap (84K 行)、ServiceStaking (68K 行) 均无测试
3. **数据库层** (`kit-bg/src/dbs/`) — 97 文件仅 1 测试，含 v4→v5 迁移逻辑
4. **状态管理** (`kit-bg/src/states/jotai/`) — 23+ atom 文件，0 测试
5. **硬件钱包通信** (`shared/src/hardware/`) — 0 测试

---

## 覆盖率目标设定

### 按风险等级分层阈值

| 风险等级 | 包/目录 | Lines | Branches | Functions | 理由 |
|---------|---------|-------|----------|-----------|------|
| **安全关键** | `core/src/secret/` | **90%** | **85%** | **90%** | 加密/密钥派生，出错=资金丢失 |
| **签名关键** | `kit-bg/src/vaults/` | **75%** | **70%** | **75%** | 交易签名，直接涉及资产安全 |
| **纯函数工具** | `shared/src/utils/` | **80%** | **75%** | **80%** | 无副作用，容易测、回报高 |
| **链实现** | `core/src/chains/` | **65%** | **60%** | **65%** | 每条链逻辑独立，按优先链逐步推进 |
| **数据层** | `kit-bg/src/dbs/` | **60%** | **50%** | **60%** | 数据完整性重要，但 mock 成本较高 |
| **核心服务** | `kit-bg/src/services/` | **50%** | **45%** | **50%** | 业务复杂度高，依赖多，50% 是务实起点 |
| **状态管理** | `kit-bg/src/states/` | **50%** | **45%** | **50%** | 状态流转出错影响全局 |
| **全局兜底** | global | **30%** | **25%** | **30%** | 包含所有代码的最低门槛 |

### 分步落地配置

**第一步（立即）— 防止退化，卡住底线**

```js
coverageThreshold: {
  global: { lines: 5, branches: 3, functions: 5, statements: 5 },
},
```

**第二步（Phase 1-2 完成后，~6 周）**

```js
coverageThreshold: {
  global: { lines: 20, branches: 15, functions: 20, statements: 20 },
  './packages/core/src/secret/':   { lines: 85, branches: 80, functions: 85 },
  './packages/shared/src/utils/':  { lines: 60, branches: 50, functions: 60 },
},
```

**第三步（Phase 3 完成后，~14 周）— 长期目标**

```js
coverageThreshold: {
  global: { lines: 35, branches: 25, functions: 35, statements: 35 },
  './packages/core/src/secret/':     { lines: 90, branches: 85, functions: 90 },
  './packages/kit-bg/src/vaults/':   { lines: 75, branches: 70, functions: 75 },
  './packages/shared/src/utils/':    { lines: 80, branches: 75, functions: 80 },
  './packages/core/src/chains/':     { lines: 65, branches: 60, functions: 65 },
  './packages/kit-bg/src/services/': { lines: 50, branches: 45, functions: 50 },
  './packages/kit-bg/src/dbs/':      { lines: 60, branches: 50, functions: 60 },
  './packages/kit-bg/src/states/':   { lines: 50, branches: 45, functions: 50 },
},
```

### 增量覆盖率（比全局数字更重要）

- 每个 PR 的**新增/修改代码**覆盖率不低于 **80%**
- 通过 CI 工具（如 Codecov）在 PR 评论中展示增量覆盖率
- 这比提升全局数字更有效，确保新代码质量的同时不给存量代码补测试造成压力

---

## 提升计划

### Phase 0: 测试基础设施建设 (1-2 周)

> 先打地基，再盖楼。

#### 0.1 配置覆盖率收集与门禁

在 `jest.config.js` 中添加：

```js
collectCoverageFrom: [
  'packages/core/src/**/*.ts',
  'packages/shared/src/**/*.ts',
  'packages/kit-bg/src/**/*.ts',
  '!**/*.d.ts',
  '!**/index.ts',        // barrel files
  '!**/__mocks__/**',
],
coverageThreshold: {
  global: { lines: 5, branches: 3, functions: 5, statements: 5 },
},
coverageReporters: ['text', 'lcov', 'json-summary'],
```

#### 0.2 CI 集成覆盖率报告

- 在 `unittest.yml` 中添加 `--coverage` 标志
- 上传 `lcov` 报告至 Codecov 或类似服务
- PR 中自动评论覆盖率变化（增量覆盖率门禁 ≥80%）

#### 0.3 创建共享测试工具包

```
packages/shared/src/test-utils/
├── factories/          # 数据工厂 (Account, Wallet, Network, Token)
├── fixtures/           # 固定测试数据 (私钥、地址、交易)
├── mocks/             # 可复用 mock (storage, network, hardware)
└── helpers.ts         # 断言辅助函数
```

---

### Phase 1: 关键安全路径 (2-4 周) — 最高优先级

> 测试钱包核心安全功能，防止资金损失。

#### 1.1 Vault 签名层测试

**目标**: `packages/kit-bg/src/vaults/` 核心签名路径

| 测试目标 | 文件路径 | 测试内容 |
|---------|---------|---------|
| KeyringHd 签名 | `vaults/impls/*/KeyringHd.ts` | signTransaction, signMessage, prepareAccounts |
| KeyringImported | `vaults/impls/*/KeyringImported.ts` | 私钥导入后签名验证 |
| KeyringHardware | `vaults/impls/*/KeyringHardware.ts` | Mock 硬件设备签名流程 |
| VaultBase | `vaults/base/VaultBase.ts` | buildDecodedTx, buildEncodedTx |

**优先链**: BTC, EVM, SOL, TRON (用户量最大)

**方法**:
- 使用已知测试向量（test vectors）验证签名正确性
- Mock 硬件设备接口，测试通信流程
- 测试边界情况：空交易、超大金额、非法输入

#### 1.2 Core 加密层补充

**目标**: 补全 `packages/core/src/secret/` 的边界测试

- BIP32 派生的边界路径 (hardened/unhardened 混合)
- BIP39 助记词校验的非法输入
- 各 curve (secp256k1, ed25519, nistp256) 的边界签名
- AES256 加密的 IV 重用检测

#### 1.3 地址生成验证

**目标**: 每条链的地址派生正确性

- 使用 BIP44/BIP84/BIP86 标准测试向量
- 测试 mainnet/testnet 地址格式
- 测试 fresh-address 生成（BTC UTXO 链）

---

### Phase 2: 核心服务层 (3-5 周) — 高优先级

> 测试交易构建、手续费计算等核心业务逻辑。

#### 2.1 ServiceSend 测试

```
packages/kit-bg/src/services/ServiceSend.ts
```

| 测试场景 | 说明 |
|---------|------|
| 交易构建 | buildEncodedTx 对各链类型的正确性 |
| 手续费计算 | estimateFee 不同网络条件下的返回值 |
| 交易广播 | broadcastTransaction 成功/失败/超时处理 |
| UTXO 选择 | BTC 系链的 UTXO 选择策略 |
| EIP-1559 | EVM 链 maxFeePerGas/maxPriorityFeePerGas |

#### 2.2 ServiceSwap 测试

```
packages/kit-bg/src/services/ServiceSwap.ts
```

- 路由计算逻辑（最优路径选择）
- 滑点计算与保护
- 跨链 swap 流程
- 报价对比逻辑

#### 2.3 ServiceStaking 测试

- 质押/取消质押金额计算
- 锁定期计算
- 收益率计算

#### 2.4 其他关键服务

| 服务 | 优先级 | 测试重点 |
|-----|--------|---------|
| ServicePassword | 高 | 密码验证、加密存储 |
| ServiceAccount | 高 | 账户创建/导入/派生 |
| ServiceNetwork | 中 | 网络切换、RPC 配置 |
| ServiceHistory | 中 | 交易记录解析 |
| ServiceCloudBackup | 中 | 备份/恢复完整性 |

---

### Phase 3: 数据与状态层 (2-3 周) — 中优先级

#### 3.1 数据库层

```
packages/kit-bg/src/dbs/
```

- Local DB CRUD 操作正确性
- Schema 迁移 (v4→v5) 数据完整性
- 并发读写安全性
- 索引查询性能

#### 3.2 Jotai 状态管理

```
packages/kit-bg/src/states/jotai/atoms/
```

- account atom: 账户切换、多钱包状态
- password atom: 密码锁定/解锁状态机
- hardware atom: 设备连接/断开状态
- swap/market atom: 交易状态流转

#### 3.3 Shared 工具函数补全

当前 72 个工具文件仅 12 个有测试，优先补全：

| 工具文件 | 理由 |
|---------|------|
| `feeUtils.ts` | 手续费计算影响用户资金 |
| `tokenUtils.ts` | Token 精度/余额显示 |
| `evmUtils.ts` | EVM 地址/数据编解码 |
| `networkUtils.ts` | 网络识别影响链路选择 |
| `txActionUtils.ts` | 交易类型解析 |
| `approvalUtils.ts` | 授权检测安全相关 |
| `chainValueUtils.ts` | 链上数值转换 |
| `historyUtils.ts` | 交易历史解析 |

---

## 覆盖率目标路线图

| 阶段 | 时间 | 全局覆盖率目标 | 重点 |
|-----|------|-------------|------|
| Phase 0 | 第 1-2 周 | 建立基线 (5%) | 基础设施 + 度量 |
| Phase 1 | 第 3-6 周 | 20% | 签名 + 加密 + 地址 |
| Phase 2 | 第 7-11 周 | 35% | 核心服务 |
| Phase 3 | 第 12-14 周 | 35% → 45% | 数据 + 状态 + 工具函数 |

---

## 实施原则

1. **测试金字塔**: 70% 单元测试 + 20% 集成测试 + 10% E2E 测试
2. **风险优先**: 先测资金相关（签名、交易、地址），再测业务逻辑
3. **增量推进**: 每个 PR 新增/修改代码覆盖率 ≥80%，逐步提升基线
4. **测试向量复用**: 从 BIP 标准、链官方 SDK 文档中收集标准测试向量
5. **Mock 边界清晰**: 只 mock 外部依赖（网络、硬件、存储），不 mock 被测模块内部逻辑
6. **可维护性**: 测试代码与生产代码同等重视，避免脆弱测试（brittle tests）
7. **不为凑数字写无意义测试**: 宁可覆盖率低一点，每个测试都要有价值
