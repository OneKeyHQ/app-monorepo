# Binance Connect Token 过滤优化

> **创建日期**: 2026-02-01
> **状态**: 已设计，待实现

## 目标

优化 "从 Binance 接收" 流程，只显示 Binance 支持提币的 tokens，避免用户选择不支持的 token。

## 流程

```
1. 用户点击 Binance 按钮
   ↓
2. 调用 API 获取 Binance 支持的 tokens（缓存 10 分钟）
   GET /wallet/v1/exchange/binance/supported-assets
   ↓
3. Token Selector 显示交集（用户 tokens ∩ Binance 支持的 tokens）
   匹配逻辑：networkId + symbol.toUpperCase()
   ↓
4. 用户选择 token（含网络）
   ↓
5. 调后端创建订单（金额默认 "1"，MVP 阶段）
   POST /wallet/v1/exchange/binance/pre-order
   ↓
6. 拿到 redirectUrl → Linking.openURL → 跳转 Binance App
```

## API 接口

### 1. 获取支持的 tokens

```
GET /wallet/v1/exchange/binance/supported-assets

Response:
{
  "evm--56": {
    "BNB": { "withdrawEnable": true },
    "USDT": { "withdrawEnable": true },
    ...
  },
  "evm--1": {
    "ETH": { "withdrawEnable": true },
    "USDC": { "withdrawEnable": true },
    ...
  }
}
```

### 2. 创建预订单

```
POST /wallet/v1/exchange/binance/pre-order

Request:
{
  "networkId": "evm--1",
  "address": "0x...",
  "cryptoCurrency": "USDC",
  "requestedAmount": "1"
}

Response:
{
  "orderId": "xxx",
  "externalOrderId": "xxx",
  "redirectUrl": "https://app.binance.com/...",
  "linkExpireTime": 1777692520806
}
```

## 文件改动

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/shared/src/types/exchange.ts` | 新建 | 类型定义 |
| `packages/kit-bg/src/services/ServiceToken.ts` | 修改 | 新增 `getBinanceSupportedAssets` 和 `createBinancePreOrder` 方法 |
| `packages/kit/src/views/Home/components/WalletActions/WalletActionExchange.tsx` | 修改 | 改造 Binance 点击逻辑 |
| Token Selector 组件 | 修改 | 支持 `exchangeFilter` 参数过滤 |

## 类型定义

```typescript
// packages/shared/src/types/exchange.ts

export type IBinanceSupportedAssets = Record<
  string,  // networkId: "evm--56", "evm--1"
  Record<string, { withdrawEnable: boolean }>
>;

export interface IBinancePreOrderResponse {
  orderId: string;
  externalOrderId: string;
  redirectUrl: string;
  linkExpireTime: number;
}

export interface IExchangeFilter {
  exchangeId: string;
  supportedAssets: IBinanceSupportedAssets;
}
```

## Token Selector 过滤逻辑

```typescript
const filterByExchangeSupport = (
  tokens: IToken[],
  exchangeFilter: IExchangeFilter,
) => {
  const { supportedAssets } = exchangeFilter;
  return tokens.filter((token) => {
    const networkAssets = supportedAssets[token.networkId];
    if (!networkAssets) return false;

    const symbolUpper = token.symbol.toUpperCase();
    const assetConfig = networkAssets[symbolUpper];
    return assetConfig?.withdrawEnable === true;
  });
};
```

## WalletActionExchange 核心逻辑

```typescript
const handleExchangePress = useCallback(async (config: IExchangeConfig) => {
  if (config.id === EExchangeId.Binance && platformEnv.isNative && isExchangeInstalled(config.id)) {
    // 1. 获取支持的 tokens
    const supportedAssets = await backgroundApiProxy.serviceToken.getBinanceSupportedAssets();

    // 2. 打开 Token Selector（带过滤）
    navigation.push(EModalReceiveRoutes.ReceiveSelectToken, {
      ...existingParams,
      exchangeFilter: {
        exchangeId: EExchangeId.Binance,
        supportedAssets,
      },
      onSelect: async (selectedToken: IToken) => {
        // 3. 创建订单
        const result = await backgroundApiProxy.serviceToken.createBinancePreOrder({
          networkId: selectedToken.networkId,
          address: account.address,
          cryptoCurrency: selectedToken.symbol.toUpperCase(),
          requestedAmount: '1',
        });

        // 4. 跳转 Binance
        await Linking.openURL(result.redirectUrl);
        navigation.popToTop();
      },
    });
    return;
  }

  // 其他交易所保持原逻辑...
}, [...]);
```

## 后续优化（MVP 后）

1. **金额输入** - 增加金额输入步骤，不再使用默认值
2. **专用页面** - 创建 `ReceiveFromExchange` 专用页面，更好的 UX
3. **支持更多交易所** - OKX、Coinbase 等（如果有类似 API）
4. **Webhook 处理** - 接收 Binance 回调，显示交易状态
