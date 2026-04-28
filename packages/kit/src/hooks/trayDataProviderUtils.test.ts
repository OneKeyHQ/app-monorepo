import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  TRAY_DATA_REFRESH_EVENT_NAMES,
  collectTrayTrackedTxs,
  getTrayCurrencyDisplayInfo,
  getTrayTokenValueInTargetCurrency,
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
