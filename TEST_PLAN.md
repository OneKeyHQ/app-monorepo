# OneKey App Monorepo 测试方案

## 项目概述

- **仓库**: https://github.com/OneKeyHQ/app-monorepo
- **类型**: 加密货币钱包 Monorepo
- **技术栈**: TypeScript, React Native, React, Electron, Expo
- **测试框架**: Jest 29.7.0 (已配置)

## 现有测试覆盖

✅ 已发现 8 个测试文件 (packages/shared/src/utils/)

❌ 未覆盖模块:
- packages/core/src/ - 核心区块链逻辑
- packages/kit-bg/src/services/ - 后台服务
- packages/components/ - UI 组件

## 高优先级测试模块

### 1. packages/core/src/base/ - 核心基础类
| 模块 | 测试重点 | 复杂度 |
|-----|---------|-------|
| ChainSigner.ts | 签名逻辑、密钥管理 | 高 |
| CoreChainApiBase.ts | 链 API 基础类 | 高 |
| CoreChainApiHub.ts | 链 API 调度 | 中 |

### 2. packages/core/src/utils/ - 核心工具
| 模块 | 测试重点 | 复杂度 |
|-----|---------|-------|
| coinSelectUtils.ts | UTXO 选择算法 | 高 |

##3 3. packages/shared/src/utils/ - 共享工具 (补充)
| 模块 | 测试重点 | 优先级 |
|-----|---------|-------|
| bufferUtils.ts | Buffer 转换、编码 | 高 |
| hexUtils.ts | Hex 编码/解码 | 高 |
| chainValueUtils.ts | 链数值计算 | 高 |
| feeUtils.ts | 费用计算 | 高 |
| deviceUtils.ts | 硬件设备工具 | 高 |

##3 4. packages/kit-bg/src/services/ - 后台服务
| 模块 | 测试重点 | 复杂度 |
|-----|---------|-------|
| ServiceGas.ts | Gas 费用服务 | 高 |
| ServiceAccount.ts | 账户管理服务 | 高 |
| ServiceAccountSelector.ts | 账户选择服务 | 中 |
| ServiceApproval.ts | 交易审批服务 | 高 |
| ServiceHardware.ts | 硬件钱包服务 | 高 |
| ServiceHistory.ts | 历史记录服务 | 中 |
| ServiceNetwork.ts | 网络配置服务 | 中 |
| ServicePromise.ts | Promise 管理服务 | 低 |
| ServiceSetting.ts | 设置服务 | 低 |
| ServiceToken.ts | Token 管理服务 | 中 |

## 示例测试代码

### ChainSigner 测试
```typescript
// packages/core/src/base/__tests__/ChainSigner.test.ts
import { ChainSigner } from '../ChainSigner';

describe('ChainSigner', () => {
  describe('signTransaction', () => {
    it('should sign a valid transaction', async () => {
      const signer = new ChainSigner();
      const tx = { to: '0x...', value: '1000' };
      const result = await signer.signTransaction(tx, privateKey);
      expect(result.signature).toBeDefined();
      expect(result.hash).toMatch(/^0x[a-f0-9]+$/);
    });

    it('should throw error for invalid private key', async () => {
      const signer = new ChainSigner();
      await expect(
        signer.signTransaction(tx, 'invalid')
      ).rejects.toThrow('Invalid private key');
    });
  });
});
```

### UTXO 选择算法测试
```typescript
// packages/core/src/utils/__tests__/coinSelectUtils.test.ts
import { coinSelect } from '../coinSelectUtils';

describe('coinSelect', () => {
  it('should select optimal UTXOs for transaction', () => {
    const utxos = [
      { value: 10000 },
      { value: 5000 },
      { value: 3000 },
    ];
    const target = 12000;
    const feeRate = 10;
    
    const result = coinSelect(utxos, target, feeRate);
    
    expect(result.inputs).toHaveLength(2);
    expect(result.outputs).toBeDefined();
    expect(result.fee).toBeGreaterThan(0);
  });

  it('should return empty inputs when insufficient funds', () => {
    const utxos = [{ value: 1000 }];
    const result = coinSelect(utxos, 5000, 10);
    expect(result.inputs).toHaveLength(0);
  });
});
```

##3 Buffer 工具测试
```typescript
// packages/shared/src/utils/__tests__/bufferUtils.test.ts
import { bufferToHex, hexToBuffer } from '../bufferUtils';

describe('bufferUtils', () => {
  describe('bufferToHex', () => {
    it('should convert buffer to hex string', () => {
      const buffer = Buffer.from([0x00, 0x01, 0xff]);
      expect(bufferToHex(buffer)).toBe('0x0001ff');
    });

    it('should handle empty buffer', () => {
      expect(bufferToHex(Buffer.alloc(0))).toBe('0x');
    });
  });

  describe('hexToBuffer', () => {
    it('should convert hex string to buffer', () => {
      const result = hexToBuffer('0x0001ff');
      expect(result).toEqual(Buffer.from([0x00, 0x01, 0xff]));
    });

    it('should throw for invalid hex', () => {
      expect(() => hexToBuffer('invalid')).toThrow();
    });
  });
});
```

##3 Gas 服务测试
```typescript
// packages/kit-bg/src/services/__tests__/ServiceGas.test.ts
import { ServiceGas } from '../ServiceGas';

describe('ServiceGas', () => {
  let service: ServiceGas;

  beforeEach(() => {
    service = new ServiceGas();
  });

  describe('estimateGas', () => {
    it('should estimate gas for transfer', async () => {
      const params = {
        to: '0x...',
        value: '1000000000000000000',
        data: '0x',
      };
      
      const estimate = await service.estimateGas(params);
      
      expect(estimate.gasLimit).toBeGreaterThan(21000);
      expect(estimate.gasPrice).toBeDefined();
      expect(estimate.maxFeePerGas).toBeDefined();
    });

    it('should handle contract interaction', async () => {
      const params = {
        to: '0x...',
        data: '0xa9059cbb...', // ERC20 transfer
      };
      
      const estimate = await service.estimateGas(params);
      expect(estimate.gasLimit).toBeGreaterThan(50000);
    });
  });

  describe('getFeeHistory', () => {
    it('should return fee history', async () => {
      const history = await service.getFeeHistory(10, 'latest', [25, 50, 75]);
      
      expect(history.baseFeePerGas).toHaveLength(11);
      expect(history.reward).toHaveLength(10);
    });
  });
});
```

## 实施计划

### 阶段 1: 工具函数 (1-2 周)
- packages/shared/src/utils/ 补充测试
- 目标覆盖率: 80%+

### 阶段 2: 核心逻辑 (2-3 周)
- packages/core/src/base/
- packages/core/src/utils/
- 目标覆盖率: 70%+

### 阶段 3: 后台服务 (3-4 周)
- packages/kit-bg/src/services/
- 需要 Mock 硬件和网络
- 目标覆盖率: 60%+

### 阶段 4: 集成测试 (2 周)
- 关键流程端到端测试
- API 集成测试

### 阶段 5: 组件测试 (持续)
- packages/components/
- UI 交互测试

## 覆盖率目标

| 模块 | 目标覆盖率 | 优先级 |
|-----|-----------|-------|
| shared/utils | 80% | 高 |
| core/base | 70% | 高 |
| core/utils | 70% | 高 |
| kit-bg/services | 60% | 高 |
| components | 50% | 中 |

## 测试命令

```bash
# 运行所有测试
yarn test

# 运行特定包测试
yarn test packages/shared

# 运行带覆盖率
yarn test --coverage

# 运行特定文件
yarn test packages/shared/src/utils/bufferUtils.test.ts
```

---

生成时间: 2026-02-25
生成者: BoringClaw 🤖
