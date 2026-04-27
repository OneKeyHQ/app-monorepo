import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  TRAY_DATA_REFRESH_EVENT_NAMES,
  getTrayCurrencyDisplayInfo,
  getTrayTokenValueInTargetCurrency,
} from './trayDataProviderUtils';

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
});
