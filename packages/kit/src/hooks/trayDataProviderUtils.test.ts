import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import type { ITrayWatchlistItem } from '@onekeyhq/shared/src/types/desktop/tray';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  TRAY_DATA_REFRESH_EVENT_NAMES,
  buildTrayWatchlistInSourceOrder,
  collectTrayTrackedTxs,
  formatTrayUsdPrice,
  getTrayCurrencyDisplayInfo,
  getTrayMarketNavigationTarget,
  getTrayTokenValueInTargetCurrency,
  getTrayWatchlistNativeInfo,
  recoverFailedTrackedTxs,
} from './trayDataProviderUtils';

function buildTrackedTx(
  id: string,
  status: EDecodedTxStatus,
  originalId?: string,
): IAccountHistoryTx {
  return {
    id,
    originalId,
    decodedTx: { status },
  } as unknown as IAccountHistoryTx;
}

function buildTicker(
  symbol: string,
  type: 'spot' | 'perps',
): ITrayWatchlistItem {
  return {
    symbol,
    name: symbol,
    icon: '',
    price: '$1.00',
    change24h: 0,
    type,
  };
}

describe('trayDataProviderUtils', () => {
  test('refresh events include watchlist sorting and enabled network changes', () => {
    expect(TRAY_DATA_REFRESH_EVENT_NAMES).toEqual(
      expect.arrayContaining([
        EAppEventBusNames.AccountDataUpdate,
        EAppEventBusNames.MarketWatchListV2Changed,
        EAppEventBusNames.EnabledNetworksChanged,
      ]),
    );
  });

  test('getTrayTokenValueInTargetCurrency only includes enabled compatible networks', () => {
    const result = getTrayTokenValueInTargetCurrency({
      tokensValue: {
        'hd-1--0_default_evm--1': '100',
        'hd-1--0_default_evm--56': '200',
        'hd-1--0_default_btc--0': '300',
      },
      usdToTargetFactor: '7.2',
      walletId: 'hd-1',
      enabledNetworksCompatibleWithWalletId: [{ id: 'evm--1' }],
      networkInfoMap: {
        'evm--1': {
          deriveType: 'default',
          mergeDeriveAssetsEnabled: false,
        },
        'evm--56': {
          deriveType: 'default',
          mergeDeriveAssetsEnabled: false,
        },
        'btc--0': {
          deriveType: 'default',
          mergeDeriveAssetsEnabled: true,
        },
      },
    });

    expect(result).toBe('720');
  });

  test('getTrayTokenValueInTargetCurrency falls back to all networks until enabled scope is loaded', () => {
    const result = getTrayTokenValueInTargetCurrency({
      tokensValue: {
        'hd-1--0_default_evm--1': '100',
        'hd-1--0_default_evm--56': '200',
      },
      usdToTargetFactor: '1',
      walletId: 'hd-1',
      enabledNetworksCompatibleWithWalletId: [],
      networkInfoMap: {},
    });

    expect(result).toBe('300');
  });

  test('getTrayCurrencyDisplayInfo follows selected non-USD fiat currency', () => {
    const result = getTrayCurrencyDisplayInfo({
      currencyInfo: { id: 'cny', symbol: '¥' },
      currencyMap: {
        cny: {
          id: 'cny',
          unit: '¥',
          name: 'Chinese Yuan',
          type: ['fiat'],
          value: '7.2',
        },
      },
    });

    expect(result.displayCurrency).toBe('cny');
    expect(result.displaySymbol).toBe('¥');
    expect(result.usdToTargetFactor.toFixed()).toBe('7.2');
  });

  test('getTrayCurrencyDisplayInfo keeps USD as the fallback currency', () => {
    const result = getTrayCurrencyDisplayInfo({
      currencyInfo: undefined,
      currencyMap: undefined,
    });

    expect(result.displayCurrency).toBe('usd');
    expect(result.displaySymbol).toBe('$');
    expect(result.usdToTargetFactor.toFixed()).toBe('1');
  });

  test('formatTrayUsdPrice always formats token rows in USD', () => {
    expect(formatTrayUsdPrice('1234.567')).toBe('$1,234.57');
    expect(formatTrayUsdPrice('0')).toBe('$0.00');
  });

  test('buildTrayWatchlistInSourceOrder preserves mixed spot and perps order', () => {
    const sourceItems = [
      { chainId: 'evm--1', contractAddress: '0xabc', isNative: false },
      { perpsCoin: 'BTC' },
      {
        chainId: 'sui--0',
        contractAddress: '0x2::sui::SUI',
        isNative: true,
      },
      { perpsCoin: 'ETH' },
    ];

    const result = buildTrayWatchlistInSourceOrder({
      sourceItems,
      resolvedItems: [
        { sourceItem: sourceItems[2], item: buildTicker('SUI', 'spot') },
        { sourceItem: sourceItems[0], item: buildTicker('ABC', 'spot') },
        { sourceItem: sourceItems[3], item: buildTicker('ETH', 'perps') },
        { sourceItem: sourceItems[1], item: buildTicker('BTC', 'perps') },
      ],
    });

    expect(result.map((item) => item.symbol)).toEqual([
      'ABC',
      'BTC',
      'SUI',
      'ETH',
    ]);
  });

  test('getTrayWatchlistNativeInfo treats SUI native as native even with an address', () => {
    const result = getTrayWatchlistNativeInfo({
      contractAddress: '0x2::sui::SUI',
      isNative: true,
    });

    expect(result.isNative).toBe(true);
    expect(result.tokenAddress).toBe('');
    expect(result.normalizedTokenAddress).toBe('');
  });

  test('getTrayMarketNavigationTarget uses native route for SUI native actions', () => {
    const result = getTrayMarketNavigationTarget({
      network: 'sui',
      tokenAddress: '0x2::sui::SUI',
      isNative: true,
    });

    expect(result).toEqual({
      screen: ETabMarketRoutes.MarketNativeDetail,
      params: {
        network: 'sui',
        isNative: true,
      },
    });
    expect(result?.params).not.toHaveProperty('tokenAddress');
  });

  test('getTrayMarketNavigationTarget uses token route for contract token actions', () => {
    const result = getTrayMarketNavigationTarget({
      network: 'eth',
      tokenAddress: '0xabc',
      isNative: false,
    });

    expect(result).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        tokenAddress: '0xabc',
        network: 'eth',
        isNative: false,
      },
    });
  });

  test('collectTrayTrackedTxs picks up Pending and Failed entries from pendingTxs bucket', () => {
    const result = collectTrayTrackedTxs({
      pendingTxs: {
        'evm--1__addr1': [
          buildTrackedTx('a', EDecodedTxStatus.Pending),
          buildTrackedTx('b', EDecodedTxStatus.Failed),
          buildTrackedTx('c', EDecodedTxStatus.Confirmed),
        ],
      },
    });

    expect(result.map((tx) => tx.id)).toEqual(['a', 'b']);
  });

  test('recoverFailedTrackedTxs recovers Failed txs that just left the pending bucket', () => {
    const trackedIds = new Set(['pending-1', 'pending-2']);
    const result = recoverFailedTrackedTxs(
      {
        confirmedTxs: {
          'evm--1__addr1': [
            buildTrackedTx('pending-1', EDecodedTxStatus.Failed),
            buildTrackedTx('pending-2', EDecodedTxStatus.Confirmed),
            buildTrackedTx('unrelated', EDecodedTxStatus.Failed),
          ],
        },
      },
      trackedIds,
    );

    expect(result.map((tx) => tx.id)).toEqual(['pending-1']);
  });

  test('recoverFailedTrackedTxs matches via originalId for chains that remap tx ids', () => {
    const trackedIds = new Set(['local-id']);
    const result = recoverFailedTrackedTxs(
      {
        confirmedTxs: {
          'ton--0__addr1': [
            buildTrackedTx('remote-id', EDecodedTxStatus.Failed, 'local-id'),
          ],
        },
      },
      trackedIds,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('remote-id');
  });

  test('recoverFailedTrackedTxs returns empty when no tracked ids are provided', () => {
    const result = recoverFailedTrackedTxs(
      {
        confirmedTxs: {
          'evm--1__addr1': [buildTrackedTx('x', EDecodedTxStatus.Failed)],
        },
      },
      new Set(),
    );

    expect(result).toEqual([]);
  });
});
