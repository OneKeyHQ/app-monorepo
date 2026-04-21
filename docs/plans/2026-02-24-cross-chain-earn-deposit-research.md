# 跨链一键存入 Earn — 方案调研

## 需求

用户在 Earn Tab 选择一个 DeFi 协议存入资产时，资产可能在其他链上。目标：用户无需手动 bridge，一键完成跨链+存入。

## Legend.xyz 的实现方式

Legend 是 Compound 团队创建的 DeFi Super App，A16z + Coinbase 领投 $15M。它的核心卖点就是 **"No bridge-first UX"**。

### 技术架构

```
┌─────────────────────────────────────────────────────────┐
│  Legend App (前端)                                        │
│  用户选择 Earn 策略 → 输入金额 → 签名一笔交易             │
└──────────────┬──────────────────────────────────────────┘
               │ 一笔源链交易（deposit intent + message）
               ▼
┌─────────────────────────────────────────────────────────┐
│  Across SpokePool (源链合约)                              │
│  锁定用户资金 + 记录 intent（含 message 字段）             │
└──────────────┬──────────────────────────────────────────┘
               │ Relayer 网络监听到 intent
               ▼
┌─────────────────────────────────────────────────────────┐
│  Relayer (第三方竞争性网络)                                │
│  用自己的资金在目标链上执行：                               │
│    1. fillRelayV3() → 转账到 Multicall Handler            │
│    2. Handler 原子性执行 message 中编码的操作：             │
│       - approve(aavePool, amount)                        │
│       - aavePool.deposit(token, amount, user, 0)         │
└──────────────┬──────────────────────────────────────────┘
               │ 几秒内完成
               ▼
┌─────────────────────────────────────────────────────────┐
│  Across Settlement (异步结算，~60分钟)                     │
│  Dataworker 验证 deposit↔fill 匹配                       │
│  UMA Optimistic Oracle 担保                               │
│  HubPool 偿还 Relayer 垫付资金                            │
└─────────────────────────────────────────────────────────┘
```

### 关键机制：Across Crosschain Actions

Across 不只是一个 bridge，它支持 **bridge + action** 组合。核心是 `message` 字段：

1. 用户 deposit 时附带一个 `message`，编码了目标链上要执行的操作
2. Relayer 在目标链 fill 时，SpokePool 会调用 recipient 合约的 `handleV3AcrossMessage()`
3. 如果 recipient 是 Across 官方的 **Generic Multicaller Handler**，它会原子性执行 message 中的所有 calls

```solidity
// message 的数据结构
struct Instructions {
    Call[] calls;              // 要执行的操作列表
    address fallbackRecipient; // 失败时资金退回地址
}

struct Call {
    address target;   // 目标合约地址
    bytes callData;   // 编码的函数调用
    uint256 value;    // ETH value
}
```

### 以 Aave Deposit 为例

用户想把 Optimism 上的 1000 USDC 存入 Arbitrum 的 Aave：

```
message = encode(Instructions{
    calls: [
        // Step 1: 授权 Aave Pool 使用 USDC
        Call(
            target: USDC_ARBITRUM,
            callData: approve(AAVE_POOL, 1000_000000),
            value: 0
        ),
        // Step 2: 调用 Aave deposit
        Call(
            target: AAVE_POOL,
            callData: deposit(USDC_ARBITRUM, 1000_000000, userAddress, 0),
            value: 0
        )
    ],
    fallbackRecipient: userAddress  // 失败时 USDC 退给用户
})
```

用户只签了一笔 Optimism 上的交易，Relayer 在 Arbitrum 上自动完成了 bridge + approve + deposit。

---

## OneKey 接入方案

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│  OneKey App                                              │
│                                                          │
│  Earn Deposit 页面                                       │
│    ├── 检测用户余额（目标链 + 其他链）                      │
│    ├── 如果目标链余额不足，显示跨链存入选项                  │
│    └── 构建 Across intent 交易 → 用户签名                  │
│                                                          │
│  新增: ServiceCrossChainDeposit (kit-bg)                  │
│    ├── 查询 Across /swap/approval API                     │
│    ├── 构建 message（encode DeFi action）                  │
│    ├── 处理 approval 交易                                  │
│    └── 追踪 deposit 状态                                   │
└─────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  Across Protocol API                                     │
│    GET /swap/chains          — 支持的链                    │
│    GET /swap/tokens          — 支持的 token               │
│    GET /swap/approval        — 获取报价 + 交易数据         │
│    GET /deposit-status       — 追踪状态                    │
└─────────────────────────────────────────────────────────┘
```

### 接入步骤

#### Phase 1: 后端 Service 层

**新增 `ServiceCrossChainDeposit`**（`packages/kit-bg/src/services/`）

```typescript
// 核心方法
class ServiceCrossChainDeposit {
  // 1. 查询支持的跨链路径
  async getSupportedRoutes(targetChainId: number, token: string);

  // 2. 获取跨链存入报价
  async getQuote(params: {
    originChainId: number;
    destinationChainId: number;
    inputToken: string;
    outputToken: string;
    amount: string;
    depositor: string;
    // DeFi action 参数
    defiProtocol: string;       // e.g. "aave-v3"
    defiAction: string;         // e.g. "deposit"
    defiTargetContract: string; // e.g. Aave Pool address
  }): Promise<ICrossChainDepositQuote>;

  // 3. 构建 message（编码目标链 DeFi 操作）
  buildMessage(params: {
    token: string;
    amount: string;
    defiAction: IDefiAction;
    fallbackRecipient: string;
  }): string;

  // 4. 追踪跨链存入状态
  async trackDeposit(params: {
    originChainId: number;
    depositTxHash: string;
  }): Promise<ICrossChainDepositStatus>;
}
```

#### Phase 2: Across API 对接

**获取报价**：调用 `GET /swap/approval`

```typescript
const quote = await axios.get('https://app.across.to/api/swap/approval', {
  params: {
    tradeType: 'exactInput',
    amount: parseUnits('1000', 6).toString(),  // 1000 USDC
    inputToken: USDC_OPTIMISM,
    originChainId: 10,         // Optimism
    outputToken: USDC_ARBITRUM,
    destinationChainId: 42161, // Arbitrum
    depositor: userAddress,
    // message 参数用于 cross-chain action
    message: encodedMessage,
    recipient: MULTICALL_HANDLER_ADDRESS,
  }
});

// 返回:
// - swapTx: 用户需要签名的源链交易
// - approvalTxns: token 授权交易（如需要）
// - expectedOutputAmount: 预期到账金额
// - expectedFillTime: 预期完成时间（通常 2-5 秒）
// - fees: 详细费用明细
```

**费用结构**（约 0.1-0.2%）：
- Relayer capital fee: ~0.01%
- Relayer gas fee: ~0.09%
- LP fee: 变动

**追踪状态**：调用 `GET /deposit-status`

```typescript
const status = await axios.get('https://app.across.to/api/deposit-status', {
  params: {
    originChainId: 10,
    depositTxHash: txHash,
  }
});
// status: "pending" | "filled" | "expired"
```

#### Phase 3: 前端 UI 层

**Earn Deposit 页面改造**：

```
用户进入 Earn Deposit 页面
  │
  ├─ 目标链余额充足 → 走现有 deposit 流程（不变）
  │
  └─ 目标链余额不足
       │
       ├─ 扫描用户其他链余额
       │
       └─ 显示跨链存入选项:
            ┌──────────────────────────────────┐
            │  存入 1,000 USDC 到 Aave (Arb)   │
            │                                   │
            │  来源: Optimism (余额: 2,500 USDC)│
            │  费用: ~$1.50 (0.15%)             │
            │  预计: ~5 秒完成                   │
            │                                   │
            │  [确认存入]                        │
            └──────────────────────────────────┘
```

**交易流程**：
1. 用户点击确认
2. 如需 token approval → 弹出授权签名
3. 弹出主交易签名（Across deposit intent）
4. 显示进度：`跨链中...` → `存入中...` → `完成`
5. 刷新 Earn 仓位数据

#### Phase 4: DeFi Action 编码器

为每个支持的 DeFi 协议实现 message 编码器：

```typescript
// 通用接口
interface IDefiActionEncoder {
  // 编码目标链操作为 Across message
  encode(params: {
    token: string;
    amount: bigint;
    userAddress: string;
  }): Instructions;
}

// Aave V3 实现
class AaveV3DepositEncoder implements IDefiActionEncoder {
  encode({ token, amount, userAddress }) {
    return {
      calls: [
        {
          target: token,
          callData: encodeApprove(AAVE_POOL, amount),
          value: 0n,
        },
        {
          target: AAVE_POOL,
          callData: encodeDeposit(token, amount, userAddress, 0),
          value: 0n,
        },
      ],
      fallbackRecipient: userAddress,
    };
  }
}
```

---

### 支持范围

**Across 支持的链**（EVM only）：
Ethereum、Optimism、Arbitrum、Base、Polygon、zkSync、Linea、Scroll、Blast、Mode、Lens 等

**支持的 Token**：
ETH、WETH、USDC、USDT、WBTC、DAI 等主流资产

**限制**：
- 仅 EVM 链（不支持 Solana、Cosmos、BTC 等）
- 需要目标链有 Across SpokePool 部署
- 需要目标链有 Multicall Handler 部署
- 依赖 Relayer 网络流动性

---

### 工作量估算

| 阶段 | 内容 | 预估 |
|------|------|------|
| Phase 1 | ServiceCrossChainDeposit 基础框架 | 2-3 天 |
| Phase 2 | Across API 对接 + 报价/状态追踪 | 2-3 天 |
| Phase 3 | Earn Deposit UI 改造（余额检测 + 跨链选项） | 3-4 天 |
| Phase 4 | DeFi Action 编码器（先支持 Aave） | 1-2 天 |
| 测试 | E2E 测试 + 边界情况处理 | 2-3 天 |
| **合计** | | **10-15 天** |

---

### 风险与兜底

| 风险 | 兜底策略 |
|------|----------|
| Relayer 无流动性 | API 返回 400，前端降级为提示手动 bridge |
| Bridge 成功但 DeFi action 失败 | `fallbackRecipient` 确保资金退回用户在目标链的地址 |
| Across 服务不可用 | 降级为现有 swap/bridge 流程 |
| 费用波动 | 展示费用明细，用户确认后再签名 |
| 非 EVM 链不支持 | 仅对 Across 覆盖的链显示跨链选项 |

---

### 参考资料

- [Across Crosschain Actions Integration Guide](https://docs.across.to/instant-bridging/embedded-crosschain-actions/crosschain-actions-integration-guide)
- [Across Generic Multicaller Handler](https://docs.across.to/instant-bridging/embedded-crosschain-actions/crosschain-actions-integration-guide/using-the-generic-multicaller-handler-contract)
- [Across Bridge API Quickstart](https://docs.across.to/developer-quickstart/bridge)
- [Across Intents Architecture](https://docs.across.to/concepts/intents-architecture-in-across)
- [Legend.xyz](https://legend.xyz/)
- [Across 1-Click Cross-Chain Actions](https://across.to/blog/1-click-cross-chain)
