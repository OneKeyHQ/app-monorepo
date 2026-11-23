/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IMarketStockTokenVariantsResponse } from '@onekeyhq/shared/types/marketV2';
import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapLimitOrderStatus,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  ETokenRiskLevel,
  type IFetchLimitOrderRes,
  type ISwapInitParams,
  type ISwapToken,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import {
  canHandleTradeAgainInSource,
  getSwapHistorySourceIntentKey,
  isTradeAgainAllowedInMarketModal,
  refreshMarketStockTradeAgainEligibility,
  useSwapHistoryTradeAgainAllowed,
} from '../pages/components/SwapHistoryTradeAgainContext';

import {
  buildLimitOrderTradeAgainParams,
  buildSwapHistoryTradeAgainParams,
} from './swapHistoryTradeAgain';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarketV2: { fetchMarketStockTokenVariants: jest.fn() } },
}));

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
  it.each([false, true])(
    'allows Trade Again once a legacy variant is verified (stale cache: %s)',
    async (hasStaleCache) => {
      const stockId = 'NOVO-B-DK';
      const locale = 'en-us';
      const stock: ISwapToken = {
        ...toToken,
        isStock: true,
        stock: { stockId, subtitle: '', sourceLogoUri: '' },
      };
      const source = {
        marketStockTrade: true,
        swapInitParams: { importToToken: stock },
        locale,
      };
      const legacyVariant: ISwapToken = {
        ...stock,
        contractAddress: '0xdef',
        stock: {
          subtitle: '',
          sourceLogoUri: '',
          underlyingAssetTicker: 'NOVO-B',
        },
      };
      const getParams = (historicalToken: ISwapToken) => {
        const item = history();
        item.protocol = EProtocolOfExchange.STOCK;
        item.baseInfo.fromToken = historicalToken;
        item.baseInfo.toToken = fromToken;
        return buildSwapHistoryTradeAgainParams(item);
      };
      const handler = {
        isAllowed: (params: ISwapInitParams) =>
          isTradeAgainAllowedInMarketModal(params, source),
        refreshEligibility: (params: ISwapInitParams) =>
          refreshMarketStockTradeAgainEligibility(params, source),
        handle: () => false,
      };
      const replay = (historicalToken: ISwapToken) => {
        const params = getParams(historicalToken);
        return params && handler.isAllowed(params);
      };
      expect(replay({ ...stock, stock: undefined })).toBe(true);
      expect(replay({ ...legacyVariant, stock: stock.stock })).toBe(true);
      expect(replay(legacyVariant)).toBe(false);
      expect(
        replay({
          ...legacyVariant,
          stock: {
            subtitle: '',
            sourceLogoUri: '',
            underlyingAssetTicker: stockId,
          },
        }),
      ).toBe(false);

      const request =
        Promise.withResolvers<IMarketStockTokenVariantsResponse>();
      const fetchVariants = jest.spyOn(
        backgroundApiProxy.serviceMarketV2,
        'fetchMarketStockTokenVariants',
      );
      fetchVariants.mockReturnValueOnce(request.promise);
      const variantsKey = swrKeys.marketStockTokenVariants({ stockId, locale });
      jest.useFakeTimers();
      try {
        if (hasStaleCache) {
          swrCacheUtils.set(variantsKey, { stockId, items: [] });
          jest.setSystemTime(Date.now() + 6000);
        }
        const params = getParams(legacyVariant);
        const { result } = renderHook(() =>
          useSwapHistoryTradeAgainAllowed(params, handler),
        );
        expect(result.current).toBe(false);
        await act(async () => {
          request.resolve({
            stockId,
            items: [
              {
                tokenId: 'novo-variant',
                issuer: 'test-issuer',
                networkId: legacyVariant.networkId,
                contractAddress: '0xDEF',
                currency: 'USD',
                status: 'active',
                tradingEnabled: true,
              },
            ],
          });
          await request.promise;
        });
        expect(result.current).toBe(true);
        expect(replay(legacyVariant)).toBe(true);
        expect(replay({ ...legacyVariant, networkId: 'evm--56' })).toBe(false);
        expect(
          replay({
            ...legacyVariant,
            stock: { stockId: 'NVO', subtitle: '', sourceLogoUri: '' },
          }),
        ).toBe(false);
      } finally {
        fetchVariants.mockReset();
        swrCacheUtils.remove(variantsKey);
        jest.useRealTimers();
      }

      expect(
        isTradeAgainAllowedInMarketModal(
          { swapTabSwitchType: ESwapTabSwitchType.SWAP },
          source,
        ),
      ).toBe(false);
    },
  );

  it.each([false, true])(
    'rechecks fresh negative stock membership once at expiry unless the detail closes (%s)',
    async (closeBeforeExpiry) => {
      const stockId = 'MSFT';
      const locale = 'en-us';
      const stock: ISwapToken = {
        ...toToken,
        isStock: true,
        stock: { stockId, subtitle: '', sourceLogoUri: '' },
      };
      const source = {
        marketStockTrade: true,
        swapInitParams: { importToToken: stock },
        locale,
      };
      const params: ISwapInitParams = {
        swapTabSwitchType: ESwapTabSwitchType.STOCK,
        importFromToken: {
          ...stock,
          contractAddress: '0xother',
          stock: undefined,
        },
        importToToken: fromToken,
      };
      const fetchVariants = jest.spyOn(
        backgroundApiProxy.serviceMarketV2,
        'fetchMarketStockTokenVariants',
      );
      fetchVariants
        .mockResolvedValueOnce({ stockId, items: [] })
        .mockResolvedValueOnce({
          stockId,
          items: [
            {
              tokenId: 'legacy',
              issuer: 'test-issuer',
              networkId: stock.networkId,
              contractAddress: '0xother',
              currency: 'USD',
              status: 'active',
              tradingEnabled: true,
            },
          ],
        });
      jest.useFakeTimers();
      try {
        await refreshMarketStockTradeAgainEligibility(params, source);
        const handler = {
          isAllowed: (entry: ISwapInitParams) =>
            isTradeAgainAllowedInMarketModal(entry, source),
          refreshEligibility: (entry: ISwapInitParams) =>
            refreshMarketStockTradeAgainEligibility(entry, source),
          handle: () => false,
        };
        const { result, unmount } = renderHook(() =>
          useSwapHistoryTradeAgainAllowed(params, handler),
        );
        await act(async () => {
          await jest.advanceTimersByTimeAsync(5999);
        });
        expect(fetchVariants).toHaveBeenCalledTimes(1);
        expect(result.current).toBe(false);
        if (closeBeforeExpiry) unmount();
        await act(async () => {
          await jest.advanceTimersByTimeAsync(1);
        });
        expect(fetchVariants).toHaveBeenCalledTimes(closeBeforeExpiry ? 1 : 2);
        expect(result.current).toBe(!closeBeforeExpiry);
        await act(async () => {
          await jest.advanceTimersByTimeAsync(6000);
        });
        expect(fetchVariants).toHaveBeenCalledTimes(closeBeforeExpiry ? 1 : 2);
      } finally {
        fetchVariants.mockReset();
        swrCacheUtils.remove(
          swrKeys.marketStockTokenVariants({ stockId, locale }),
        );
        jest.useRealTimers();
      }
    },
  );

  it.each([true, false])(
    'restricts history replay to visible Market non-stock modes (native: %s)',
    (isNative) => {
      const platform = jest.replaceProperty(platformEnv, 'isNative', isNative);
      try {
        const source = { marketNonStockTrade: true, locale: 'en-us' };
        expect(
          isTradeAgainAllowedInMarketModal(
            { swapTabSwitchType: ESwapTabSwitchType.STOCK },
            source,
          ),
        ).toBe(false);
        expect(
          isTradeAgainAllowedInMarketModal(
            { swapTabSwitchType: ESwapTabSwitchType.BRIDGE },
            source,
          ),
        ).toBe(true);
        expect(
          isTradeAgainAllowedInMarketModal(
            { swapTabSwitchType: ESwapTabSwitchType.LIMIT },
            source,
          ),
        ).toBe(!isNative);
      } finally {
        platform.restore();
      }
    },
  );

  it('keeps a controlled stock entry only for its own stock history', () => {
    const stockA = { ...toToken, isStock: true };
    const stockB = { ...stockA, contractAddress: '0xdef' };
    const params = {
      swapTabSwitchType: ESwapTabSwitchType.STOCK,
      importFromToken: fromToken,
      importToToken: stockB,
    };
    expect(canHandleTradeAgainInSource(params, stockA)).toBe(false);
    expect(canHandleTradeAgainInSource(params, stockB)).toBe(true);
    expect(
      canHandleTradeAgainInSource(
        { ...params, importFromToken: stockB, importToToken: fromToken },
        stockB,
      ),
    ).toBe(true);
    expect(
      canHandleTradeAgainInSource(params, {
        ...stockB,
        contractAddress: '0xDEF',
      }),
    ).toBe(false);
    expect(canHandleTradeAgainInSource(params)).toBe(true);
    expect(
      canHandleTradeAgainInSource(
        { ...params, importFromToken: stockA },
        stockA,
      ),
    ).toBe(false);
  });
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

  it('keeps trade direction while dropping amount and stale account, balance, price, and route data', () => {
    expect(buildSwapHistoryTradeAgainParams(history())).toEqual({
      tradeAgainFromHistory: true,
      swapTabSwitchType: ESwapTabSwitchType.SWAP,
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
    expect(result?.fromAmount).toBeUndefined();
  });

  it.each(['sol--101', 'ton--mainnet'])(
    'reacquires the multiplier for both contract tokens restored on %s',
    (networkId) => {
      const item = history();
      item.baseInfo.fromToken = {
        ...toToken,
        networkId,
        contractAddress: 'pay-mint',
        balanceMultiplier: '1',
      };
      item.baseInfo.toToken = {
        ...toToken,
        networkId,
        contractAddress: 'receive-mint',
        balanceMultiplier: '2',
      };
      const route = buildSwapHistoryTradeAgainParams(item);
      expect(route?.importFromToken).toMatchObject({
        contractAddress: 'pay-mint',
        balanceMultiplier: undefined,
      });
      expect(route?.importToToken).toMatchObject({
        contractAddress: 'receive-mint',
        balanceMultiplier: undefined,
      });
    },
  );

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

  it('opens a limit order without restoring its amount', () => {
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
    });
    expect(buildLimitOrderTradeAgainParams(order)?.fromAmount).toBeUndefined();
    expect(
      buildLimitOrderTradeAgainParams({
        ...order,
        status: ESwapLimitOrderStatus.OPEN,
      }),
    ).toBeUndefined();
  });
});
