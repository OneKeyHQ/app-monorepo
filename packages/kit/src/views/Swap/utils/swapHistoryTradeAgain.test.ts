import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapLimitOrderStatus,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  ETokenRiskLevel,
  type IFetchLimitOrderRes,
  type ISwapToken,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapHistorySourceIntentKey } from '../pages/components/SwapHistoryTradeAgainContext';

import {
  buildLimitOrderTradeAgainParams,
  buildSwapHistoryTradeAgainParams,
} from './swapHistoryTradeAgain';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  isNative: true,
  symbol: 'ETH',
  decimals: 18,
  balanceParsed: '22',
  fiatValue: '44',
  price: '2',
  accountAddress: 'old-account',
};

const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xabc',
  symbol: 'TEST',
  decimals: 6,
  name: 'Test Token',
  logoURI: 'https://example.com/logo.png',
  riskLevel: ETokenRiskLevel.WARNING,
  balanceMultiplier: '2',
  balanceParsed: '90',
  fiatValue: '180',
  price: '2',
  accountAddress: 'old-receiver',
};

function history(): ISwapTxHistory {
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.SUCCESS,
    accountInfo: {
      sender: { accountId: 'old-account', networkId: 'evm--1' },
      receiver: { accountId: 'old-account', networkId: 'evm--1' },
    },
    baseInfo: { fromToken, toToken, fromAmount: '1.2300', toAmount: '12' },
    txInfo: { sender: 'old-sender', receiver: 'other-recipient' },
    swapInfo: {
      provider: { provider: 'provider', providerName: 'Provider' },
      instantRate: '1',
    },
    date: { created: 1, updated: 1 },
  };
}

describe('swap history Trade Again', () => {
  it('distinguishes a later route intent while ignoring refreshed balances', () => {
    const route = {
      swapTabSwitchType: ESwapTabSwitchType.SWAP,
      importFromToken: fromToken,
    };
    const original = getSwapHistorySourceIntentKey(route);
    expect(
      getSwapHistorySourceIntentKey({
        ...route,
        importFromToken: { ...fromToken, balanceParsed: '30' },
      }),
    ).toBe(original);
    expect(
      getSwapHistorySourceIntentKey({
        ...route,
        swapTabSwitchType: ESwapTabSwitchType.STOCK,
      }),
    ).not.toBe(original);
    expect(
      getSwapHistorySourceIntentKey({ ...route, importFromToken: toToken }),
    ).not.toBe(original);
    expect(
      getSwapHistorySourceIntentKey({
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
      }),
    ).not.toBe(
      getSwapHistorySourceIntentKey({
        swapTabSwitchType: ESwapTabSwitchType.STOCK,
      }),
    );
  });
  it.each([
    ESwapTxHistoryStatus.SUCCESS,
    ESwapTxHistoryStatus.PARTIALLY_FILLED,
    ESwapTxHistoryStatus.FAILED,
    ESwapTxHistoryStatus.REFUNDED,
    ESwapTxHistoryStatus.EXPIRED,
    ESwapTxHistoryStatus.CANCELED,
  ])('allows terminal status %s', (status) => {
    expect(
      buildSwapHistoryTradeAgainParams({ ...history(), status }),
    ).toBeDefined();
  });

  it.each([
    ESwapTxHistoryStatus.PENDING,
    ESwapTxHistoryStatus.DEPOSIT_SUCCESS,
    ESwapTxHistoryStatus.CANCELING,
  ])('hides the action for ongoing status %s', (status) => {
    expect(
      buildSwapHistoryTradeAgainParams({ ...history(), status }),
    ).toBeUndefined();
  });

  it.each([EProtocolOfExchange.SWAP, EProtocolOfExchange.STOCK, undefined])(
    'accepts Swap, Stock and legacy protocol %s',
    (protocol) => {
      expect(
        buildSwapHistoryTradeAgainParams({ ...history(), protocol }),
      ).toBeDefined();
    },
  );

  it('rejects Limit and Private Send, including its legacy provider marker', () => {
    expect(
      buildSwapHistoryTradeAgainParams({
        ...history(),
        protocol: EProtocolOfExchange.LIMIT,
      }),
    ).toBeUndefined();
    expect(
      buildSwapHistoryTradeAgainParams({
        ...history(),
        protocol: EProtocolOfExchange.PRIVATE_SEND,
      }),
    ).toBeUndefined();
    const item = history();
    item.protocol = undefined;
    item.swapInfo.provider.provider = privateSendProvider;
    expect(buildSwapHistoryTradeAgainParams(item)).toBeUndefined();
  });

  it.each(['fromToken', 'toToken'] as const)('rejects a missing %s', (key) => {
    const item = history();
    Reflect.deleteProperty(item.baseInfo, key);
    expect(buildSwapHistoryTradeAgainParams(item)).toBeUndefined();
  });

  it.each([
    { networkId: '' },
    { symbol: '' },
    { decimals: -1 },
    { decimals: NaN },
    { contractAddress: '' },
  ])('rejects an invalid non-native token identity %o', (overrides) => {
    const item = history();
    item.baseInfo.toToken = { ...toToken, ...overrides };
    expect(buildSwapHistoryTradeAgainParams(item)).toBeUndefined();
  });

  it('keeps trade direction and amount while dropping stale account, balance, price, and route data', () => {
    expect(buildSwapHistoryTradeAgainParams(history())).toEqual({
      tradeAgainFromHistory: true,
      swapTabSwitchType: ESwapTabSwitchType.SWAP,
      fromAmount: '1.2300',
      importFromToken: {
        networkId: 'evm--1',
        contractAddress: '',
        isNative: true,
        symbol: 'ETH',
        decimals: 18,
      },
      importToToken: {
        networkId: 'evm--1',
        contractAddress: '0xabc',
        symbol: 'TEST',
        decimals: 6,
        name: 'Test Token',
        logoURI: 'https://example.com/logo.png',
        riskLevel: ETokenRiskLevel.WARNING,
        balanceMultiplier: '2',
      },
    });
  });

  it('routes a cross-chain pair to Bridge without reversing the tokens', () => {
    const item = history();
    item.baseInfo.toToken = { ...toToken, networkId: 'sol--101' };
    const result = buildSwapHistoryTradeAgainParams(item);
    expect(result?.swapTabSwitchType).toBe(ESwapTabSwitchType.BRIDGE);
    expect(result?.importFromToken.networkId).toBe('evm--1');
    expect(result?.importToToken.networkId).toBe('sol--101');
    expect(result?.fromAmount).toBe('1.2300');
  });

  it('routes Stock history and legacy stock tokens to the Stock tab', () => {
    const item = history();
    item.baseInfo.toToken = { ...toToken, isStock: true };
    expect(buildSwapHistoryTradeAgainParams(item)?.swapTabSwitchType).toBe(
      ESwapTabSwitchType.STOCK,
    );
    item.protocol = EProtocolOfExchange.STOCK;
    item.baseInfo.toToken = toToken;
    expect(buildSwapHistoryTradeAgainParams(item)?.swapTabSwitchType).toBe(
      ESwapTabSwitchType.STOCK,
    );
  });

  it('converts the original limit order input from base units', () => {
    const order: IFetchLimitOrderRes = {
      status: ESwapLimitOrderStatus.FULFILLED,
      networkId: 'evm--1',
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      fromAmount: '1234567890000000000',
      toAmount: '1',
      executedBuyAmount: '0',
      executedSellAmount: '0',
      orderId: 'order',
      provider: 'provider',
      providerInfo: { provider: 'provider', providerName: 'Provider' },
      kind: ESwapQuoteKind.SELL,
      payAddress: '',
      receiveAddress: '',
      userAddress: '',
      createdAt: 1,
      expiredAt: 1,
      partiallyFillable: false,
    };
    expect(buildLimitOrderTradeAgainParams(order)).toMatchObject({
      swapTabSwitchType: ESwapTabSwitchType.LIMIT,
      fromAmount: '1.23456789',
    });
    expect(
      buildLimitOrderTradeAgainParams({
        ...order,
        status: ESwapLimitOrderStatus.OPEN,
      }),
    ).toBeUndefined();
  });
});
