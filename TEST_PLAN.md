# OneKey App Monorepo 测试方案

## 1. 项目概述

### 1.1 项目信息
- **仓库**: https://github.com/OneKeyHQ/app-monorepo
- **类型**: 加密货币钱包 Monorepo
- **技术栈**: TypeScript, React Native, React, Electron, Expo
- **规模**: ~564MB, 2300+ Stars
- **包管理**: Yarn 4.12.0 (Workspace)

### 1.2 项目结构
```
app-monorepo/
├── apps/                    # 应用程序
│   ├── desktop/            # Electron 桌面应用
│   ├── ext/                # 浏览器扩展
│   ├── mobile/             # React Native 移动应用
│   ├── web/                # Web 应用
│   └── web-embed/          # 嵌入式 Web
├── packages/               # 共享包
│   ├── components/         # UI 组件库
│   ├── core/               # 核心区块链逻辑
│   ├── kit/                # 前端 Kit
│   ├── kit-bg/             # 后台服务
│   ├── qr-wallet-sdk/      # QR 钱包 SDK
│   └── shared/             # 共享工具函数
└── __mocks__/              # Jest Mock 文件
```

### 1.3 现有测试配置
- **测试框架**: Jest 29.7.0
- **预设**: jest-expo/web
- **转换器**: @swc/jest
- **覆盖率**: v8
- **环境**: jest-environment-node
- **现有测试文件**: 已发现部分 .test.ts 文件

---

## 2. 现有测试分析

### 2.1 已存在的测试文件
| 文件路径 | 测试内容 |
|---------|---------|
| `packages/shared/src/utils/accountUtils.test.ts` | 账户工具函数 |
| `packages/shared/src/utils/assertUtils.test.ts` | 断言工具函数 |
| `packages/shared/src/utils/dateUtils.test.ts` | 日期工具函数 |
| `packages/shared/src/utils/ipTableUtils.test.ts` | IP 表工具函数 |
| `packages/shared/src/utils/messageUtils.test.ts` | 消息工具函数 |
| `packages/shared/src/utils/networkDetectUtils.test.ts` | 网络检测工具 |
| `packages/shared/src/utils/numberUtils.test.ts` | 数字格式化工具 |
| `packages/shared/src/utils/numberUtils.locale.test.ts` | 数字本地化测试 |

### 2.2 测试覆盖率分析
**已覆盖模块**: 
- ✅ `packages/shared/src/utils/` 部分工具函数

**未覆盖模块** (高优先级):
- ❌ `packages/core/src/` - 核心区块链逻辑
- ❌ `packages/kit-bg/src/services/` - 后台服务
- ❌ `packages/shared/src/` 其他工具函数
- ❌ `packages/components/` - UI 组件

---

## 3. 推荐测试框架与工具

### 3.1 单元测试
```json
{
  "测试框架": "Jest 29.7.0",
  "断言库": "Jest 内置",
  "Mock 工具": "Jest Mock",
  "覆盖率": "v8",
  "TypeScript 支持": "@swc/jest"
}
```

### 3.2 集成测试
- **React Testing Library**: 用于组件测试
- **MSW (Mock Service Worker)**: API Mock

### 3.3 E2E 测试 (已存在)
- **Detox**: 移动端 E2E (apps/mobile/e2e)

---

## 4. 优先测试模块列表

### 4.1 高优先级 (核心业务逻辑)

#### 4.1.1 `packages/core/src/base/` - 核心基础类
| 模块 | 测试建议 | 复杂度 |
|-----|---------|-------|
| `ChainSigner.ts` | 签名逻辑、密钥管理 | 高 |
| `CoreChainApiBase.ts` | 链 API 基础类 | 高 |
| `CoreChainApiHub.ts` | 链 API 调度 | 中 |
| `CoreChainScopeBase.ts` | 链作用域管理 | 中 |

**示例测试代码**:
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

#### 4.1.2 `packages/core/src/utils/` - 核心工具
| 模块 | 测试建议 | 复杂度 |
|-----|---------|-------|
| `coinSelectUtils.ts` | UTXO 选择算法 | 高 |

**示例测试代码**:
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

#### 4.1.3 `packages/shared/src/utils/` - 共享工具 (补充测试)
| 模块 | 测试建议 | 优先级 |
|-----|---------|-------|
| `bufferUtils.ts` | Buffer 转换、编码 | 高 |
| `hexUtils.ts` | Hex 编码/解码 | 高 |
| `chainValueUtils.ts` | 链数值计算 | 高 |
| `feeUtils.ts` | 费用计算 | 高 |
| `deviceUtils.ts` | 硬件设备工具 | 高 |
| `historyUtils.ts` | 历史记录处理 | 中 |
| `imageUtils.ts` | 图片处理 | 中 |
| `networkUtils.ts` | 网络工具 | 中 |

**示例测试代码**:
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

#### 4.1.4 `packages/kit-bg/src/services/` - 后台服务
| 模块 | 测试建议 | 复杂度 |
|-----|---------|-------|
| `ServiceBase.ts` | 服务基础类 | 高 |
| `ServiceAccount.ts` | 账户服务 | 高 |
| `ServiceAddressBook.ts` | 地址簿服务 | 中 |
| `ServiceApproval.ts` | 审批服务 | 高 |
| `ServiceDApp.ts` | DApp 服务 | 高 |
| `ServiceHistory.ts` | 历史服务 | 中 |
| `ServiceGas.ts` | Gas 服务 | 高 |
| `ServiceNetwork.ts` | 网络服务 | 中 |

**示例测试代码**:
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
        networkId: 'eth',
      };
      
      const estimate = await service.estimateGas(params);
      
      expect(estimate.gasLimit).toBeGreaterThan(21000);
      expect(estimate.gasPrice).toBeDefined();
    });

    it('should handle estimation errors', async () => {
      await expect(
        service.estimateGas({ to: 'invalid', networkId: 'eth' })
      ).rejects.toThrow();
    });
  });
});
```

### 4.2 中优先级 (工具函数)

#### 4.2.1 `packages/shared/src/` 其他模块
| 模块 | 测试建议 |
|-----|---------|
| `appCrypto/` | 加密算法测试 |
| `storage/` | 存储操作测试 |
| `request/` | HTTP 请求测试 |
| `eventBus/` | 事件总线测试 |
| `logger/` | 日志工具测试 |

#### 4.2.2 `packages/core/src/chains/` - 链实现
| 模块 | 测试建议 | 备注 |
|-----|---------|-----|
| `btc/` | 比特币相关 | 部分已在 jest.config.js 中排除 |
| `evm/` | EVM 兼容链 | 优先测试 |
| `sol/` | Solana | 优先测试 |

**示例测试代码**:
```typescript
// packages/core/src/chains/evm/__tests__/EvmCore.test.ts
import { EvmCore } from '../EvmCore';

describe('EvmCore', () => {
  describe('validateAddress', () => {
    it('should validate correct Ethereum address', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      expect(EvmCore.validateAddress(address)).toBe(true);
    });

    it('should reject invalid address', () => {
      expect(EvmCore.validateAddress('invalid')).toBe(false);
    });
  });

  describe('buildTransaction', () => {
    it('should build valid transaction', () => {
      const tx = EvmCore.buildTransaction({
        to: '0x...',
        value: '1000',
        gasLimit: '21000',
      });
      expect(tx.to).toBe('0x...');
      expect(tx.value).toBe('1000');
    });
  });
});
```

### 4.3 低优先级 (UI 组件)

#### 4.3.1 `packages/components/` - UI 组件
| 组件类型 | 测试建议 |
|---------|---------|
| Button | 渲染、点击事件 |
| Input | 输入验证、格式化 |
| Modal | 显示/隐藏逻辑 |
| List | 数据渲染 |

**示例测试代码**:
```typescript
// packages/components/src/Button/__tests__/Button.test.tsx
import { render, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('should render correctly', () => {
    const { getByText } = render(<Button>Click me</Button>);
    expect(getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const onClick = jest.fn();
    const { getByText } = render(<Button onPress={onClick}>Click</Button>);
    
    fireEvent.press(getByText('Click'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when loading', () => {
    const { getByTestId } = render(<Button loading>Loading</Button>);
    expect(getByTestId('button')).toBeDisabled();
  });
});
```

---

## 5. 测试策略

### 5.1 测试金字塔
```
        /\
       /  \     E2E 测试 (Detox) - 少量
      /____\    
     /      \   集成测试 (Service + API) - 中等
    /________\  
   /          \ 单元测试 (Utils + Core) - 大量
  /____________\
```

### 5.2 Mock 策略
```typescript
// 1. 文件 Mock
jest.mock('../fileMock.js', () => 'test-file-stub');

// 2. 模块 Mock
jest.mock('@onekeyhq/components', () => ({
  Button: 'Button',
  Input: 'Input',
}));

// 3. API Mock (MSW)
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/balance', (req, res, ctx) => {
    return res(ctx.json({ balance: '1000000' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 5.3 测试命名规范
```
测试文件: [module].test.ts 或 [module].test.tsx
测试套件: describe('[ModuleName]', () => {})
测试用例: it('should [expected behavior] when [condition]', () => {})
```

---

## 6. 实施计划

### 阶段 1: 基础设施 (1-2 周)
- [ ] 完善 Jest 配置
- [ ] 添加测试覆盖率报告
- [ ] 设置 CI/CD 集成
- [ ] 创建测试工具库

### 阶段 2: 核心模块 (2-3 周)
- [ ] `packages/core/src/base/` 测试
- [ ] `packages/core/src/utils/` 测试
- [ ] `packages/shared/src/utils/` 补充测试

### 阶段 3: 服务层 (2-3 周)
- [ ] `packages/kit-bg/src/services/` 测试
- [ ] API Mock 配置
- [ ] 集成测试

### 阶段 4: 组件层 (1-2 周)
- [ ] `packages/components/` 基础组件测试
- [ ] 快照测试

### 阶段 5: 持续改进 (持续)
- [ ] 覆盖率监控
- [ ] 测试优化
- [ ] 文档更新

---

## 7. 推荐的 npm 脚本

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:core": "jest packages/core",
    "test:shared": "jest packages/shared",
    "test:kit-bg": "jest packages/kit-bg"
  }
}
```

---

## 8. 覆盖率目标

| 模块 | 目标覆盖率 | 当前状态 |
|-----|-----------|---------|
| `packages/core/src/utils/` | 80% | 0% |
| `packages/core/src/base/` | 75% | 0% |
| `packages/shared/src/utils/` | 85% | ~30% |
| `packages/kit-bg/src/services/` | 70% | 0% |
| `packages/components/` | 60% | 0% |

---

## 9. 测试示例汇总

### 9.1 工具函数测试模板
```typescript
import { functionName } from '../module';

describe('functionName', () => {
  // 正常情况
  it('should return expected result for valid input', () => {
    expect(functionName(validInput)).toBe(expectedOutput);
  });

  // 边界情况
  it('should handle edge case', () => {
    expect(functionName(edgeCase)).toBe(expected);
  });

  // 错误处理
  it('should throw error for invalid input', () => {
    expect(() => functionName(invalidInput)).toThrow();
  });
});
```

### 9.2 异步函数测试模板
```typescript
describe('asyncFunction', () => {
  it('should resolve with expected data', async () => {
    const result = await asyncFunction(params);
    expect(result).toEqual(expectedData);
  });

  it('should reject with error', async () => {
    await expect(asyncFunction(invalidParams)).rejects.toThrow('Error message');
  });
});
```

### 9.3 类测试模板
```typescript
describe('ClassName', () => {
  let instance: ClassName;

  beforeEach(() => {
    instance = new ClassName();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should perform expected action', () => {
      const result = instance.methodName();
      expect(result).toBe(expected);
    });
  });
});
```

---

## 10. 注意事项

### 10.1 安全相关
- 不要在测试中包含真实私钥或助记词
- 使用固定的测试向量进行加密测试
- Mock 外部 API 调用

### 10.2 区块链相关
- 使用测试网数据
- Mock 区块链节点响应
- 使用固定的区块数据

### 10.3 性能考虑
- 使用 `test.concurrent` 并行测试
- 避免在单元测试中进行真实网络请求
- 使用 `jest --maxWorkers` 控制并发

---

## 附录: 测试文件清单

### 建议新增的测试文件

```
packages/
├── core/
│   └── src/
│       ├── base/
│       │   └── __tests__/
│       │       ├── ChainSigner.test.ts
│       │       ├── CoreChainApiBase.test.ts
│       │       └── CoreChainScopeBase.test.ts
│       └── utils/
│           └── __tests__/
│               └── coinSelectUtils.test.ts
├── shared/
│   └── src/
│       └── utils/
│           └── __tests__/
│               ├── bufferUtils.test.ts
│               ├── hexUtils.test.ts
│               ├── chainValueUtils.test.ts
│               ├── feeUtils.test.ts
│               └── deviceUtils.test.ts
└── kit-bg/
    └── src/
        └── services/
            └── __tests__/
                ├── ServiceBase.test.ts
                ├── ServiceGas.test.ts
                └── ServiceApproval.test.ts
```

---

*文档生成时间: 2026-02-25*
*基于仓库分支: x*
