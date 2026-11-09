import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import type {
  ITrayData,
  ITrayWatchlistItem,
} from '@onekeyhq/shared/src/types/desktop/tray';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  TRAY_DATA_REFRESH_EVENT_NAMES,
  TRAY_QUOTE_PLACEHOLDER,
  buildTrayListingQuoteDisplay,
  buildTrayWatchlistInSourceOrder,
  collectTrayTrackedTxs,
  createTrayDataSender,
  formatTrayUsdPrice,
  getTrayCurrencyDisplayInfo,
  getTrayMarketNavigationTarget,
  getTrayTokenValueInTargetCurrency,
  getTrayWatchlistNativeInfo,
} from './trayDataProviderUtils';

function buildTrackedTx(
  id: string,
  status: EDecodedTxStatus,
  originalId?: string,
  accountId = 'account-1',
  networkId = 'evm--1',
): IAccountHistoryTx {
  return {
    id,
    originalId,
    decodedTx: { accountId, networkId, status },
  } as unknown as IAccountHistoryTx;
}

function buildActiveScope(accountId = 'account-1') {
  return { accountIds: [accountId] };
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

function buildTrayData(overrides: Partial<ITrayData> = {}): ITrayData {
  return {
    accountId: 'account-1',
    wallet: { name: 'Wallet', emoji: '', avatarImg: '' },
    account: { name: 'Account #1' },
    totalBalance: { amount: '40.88', currency: 'usd', symbol: '$' },
    watchlist: [],
    pendingTxs: [],
    ...overrides,
  };
}

function buildTrayDataSender(initialHideValue = false) {
  const state = { hideValue: initialHideValue };
  const send = jest.fn<void, [ITrayData]>();
  const sender = createTrayDataSender({
    send,
    getHideValue: () => state.hideValue,
  });
  return { state, send, sender };
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

  test('buildTrayListingQuoteDisplay formats a complete listing quote', () => {
    expect(
      buildTrayListingQuoteDisplay({
        price: '1234.567',
        priceChange24hPercent: '-1.5',
      }),
    ).toEqual({ price: '$1,234.57', change24h: -1.5 });
    expect(
      buildTrayListingQuoteDisplay({
        price: 0,
        priceChange24hPercent: 0,
      }),
    ).toEqual({ price: '$0.00', change24h: 0 });
  });

  test('buildTrayListingQuoteDisplay keeps a missing quote visible as missing', () => {
    expect(buildTrayListingQuoteDisplay({})).toEqual({
      price: TRAY_QUOTE_PLACEHOLDER,
      change24h: undefined,
    });
    expect(
      buildTrayListingQuoteDisplay({
        price: null,
        priceChange24hPercent: undefined,
      }),
    ).toEqual({ price: TRAY_QUOTE_PLACEHOLDER, change24h: undefined });
    // Non-numeric markers from the listing API mean "no data", not zero.
    expect(
      buildTrayListingQuoteDisplay({
        price: ' - ',
        priceChange24hPercent: '-',
      }),
    ).toEqual({ price: TRAY_QUOTE_PLACEHOLDER, change24h: undefined });
    expect(
      buildTrayListingQuoteDisplay({
        price: '42',
        priceChange24hPercent: '',
      }),
    ).toEqual({ price: '$42.00', change24h: undefined });
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

  test('buildTrayWatchlistInSourceOrder keeps asset and stock listings in place', () => {
    // OK-63844 / OK-63845: listing favorites have no chainId and must be
    // ordered by their own identity instead of being dropped.
    const sourceItems = [
      { assetId: 'bitcoin', chainId: '', contractAddress: '' },
      { chainId: 'evm--1', contractAddress: '0xabc', isNative: false },
      { stockId: 'AAPL', chainId: '', contractAddress: '' },
      { perpsCoin: 'ETH' },
    ];

    const result = buildTrayWatchlistInSourceOrder({
      sourceItems,
      resolvedItems: [
        { sourceItem: sourceItems[3], item: buildTicker('ETH', 'perps') },
        { sourceItem: sourceItems[2], item: buildTicker('AAPL', 'spot') },
        { sourceItem: sourceItems[1], item: buildTicker('ABC', 'spot') },
        { sourceItem: sourceItems[0], item: buildTicker('BTC', 'spot') },
      ],
    });

    expect(result.map((item) => item.symbol)).toEqual([
      'BTC',
      'ABC',
      'AAPL',
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

  test('getTrayWatchlistNativeInfo treats empty-address spot rows as native even when isNative is false', () => {
    const result = getTrayWatchlistNativeInfo({
      contractAddress: '',
      isNative: false,
    });

    expect(result.isNative).toBe(true);
    expect(result.tokenAddress).toBe('');
    expect(result.normalizedTokenAddress).toBe('');
  });

  test('getTrayMarketNavigationTarget keeps the native type-tag address for SUI native actions', () => {
    // OK-63847: MarketNativeDetail without an address never matches the Sui
    // detail identity (`0x…2::sui::SUI`), which left the trade panel blank.
    const result = getTrayMarketNavigationTarget({
      network: 'sui',
      tokenAddress: '0x2::sui::SUI',
      isNative: true,
    });

    expect(result).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        tokenAddress: '0x2::sui::SUI',
        network: 'sui',
        isNative: true,
      },
    });
  });

  test('getTrayMarketNavigationTarget uses native route for empty-address spot actions', () => {
    const result = getTrayMarketNavigationTarget({
      network: 'bsc',
      tokenAddress: '',
      isNative: false,
    });

    expect(result).toEqual({
      screen: ETabMarketRoutes.MarketNativeDetail,
      params: {
        network: 'bsc',
        isNative: true,
      },
    });
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

  test('collectTrayTrackedTxs picks up Pending entries from pendingTxs bucket', () => {
    const result = collectTrayTrackedTxs(
      {
        pendingTxs: {
          'evm--1_addr1': [
            buildTrackedTx('a', EDecodedTxStatus.Pending),
            buildTrackedTx('b', EDecodedTxStatus.Failed),
            buildTrackedTx('c', EDecodedTxStatus.Confirmed),
          ],
        },
      },
      buildActiveScope(),
    );

    expect(result.map((tx) => tx.id)).toEqual(['a']);
  });

  test('collectTrayTrackedTxs filters pending bucket by active account id across local-history keys', () => {
    const result = collectTrayTrackedTxs(
      {
        pendingTxs: {
          'evm--1_addr1': [
            buildTrackedTx('active-evm', EDecodedTxStatus.Pending),
            buildTrackedTx(
              'other-account',
              EDecodedTxStatus.Pending,
              undefined,
              'account-2',
            ),
          ],
          'sui--mainnet_addr1': [
            buildTrackedTx(
              'active-sui',
              EDecodedTxStatus.Pending,
              undefined,
              'account-1',
              'sui--mainnet',
            ),
          ],
          'evm--1_addr2': [
            buildTrackedTx('other-key-same-account', EDecodedTxStatus.Pending),
          ],
        },
      },
      buildActiveScope(),
    );

    expect(result.map((tx) => tx.id)).toEqual([
      'active-evm',
      'active-sui',
      'other-key-same-account',
    ]);
  });

  test('collectTrayTrackedTxs matches network account ids from indexed account scope', () => {
    const result = collectTrayTrackedTxs(
      {
        pendingTxs: {
          "tbtc--0_tr([8a5ecad8/86'/1'/1']tpub/<0;1>/*)": [
            buildTrackedTx(
              'active-btc-testnet',
              EDecodedTxStatus.Pending,
              undefined,
              "hd-1--m/86'/1'/1'",
              'tbtc--0',
            ),
            buildTrackedTx(
              'other-indexed-account',
              EDecodedTxStatus.Pending,
              undefined,
              "hd-1--m/86'/1'/0'",
              'tbtc--0',
            ),
          ],
        },
      },
      {
        accountIds: ["hd-1--m/86'/1'/1'", "hd-1--m/44'/60'/0'/0/1"],
      },
    );

    expect(result.map((tx) => tx.id)).toEqual(['active-btc-testnet']);
  });

  test('collectTrayTrackedTxs returns empty when active account is missing', () => {
    const result = collectTrayTrackedTxs(
      {
        pendingTxs: {
          'evm--1_addr1': [buildTrackedTx('a', EDecodedTxStatus.Pending)],
        },
      },
      {},
    );

    expect(result).toEqual([]);
  });

  // The tray renderer has no jotai store of its own: the hide-value setting
  // only reaches it on the payloads the main window sends (OK-56225).
  test('createTrayDataSender stamps every payload with the hide-value setting', () => {
    const { send, sender } = buildTrayDataSender(true);

    sender.send(buildTrayData());

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual(buildTrayData({ hideValue: true }));
  });

  test('createTrayDataSender reads the hide-value setting when the payload is sent', () => {
    const { state, send, sender } = buildTrayDataSender(false);
    // A gather builds its payload up front and can outlive a toggle.
    const gathered = buildTrayData();
    state.hideValue = true;

    sender.send(gathered);

    expect(send.mock.calls[0][0].hideValue).toBe(true);
  });

  test('createTrayDataSender re-delivers the last payload as soon as the setting flips', () => {
    const { state, send, sender } = buildTrayDataSender(false);
    sender.send(buildTrayData());

    state.hideValue = true;
    sender.syncHideValue();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(buildTrayData({ hideValue: true }));

    state.hideValue = false;
    sender.syncHideValue();

    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2][0]).toEqual(buildTrayData({ hideValue: false }));
  });

  test('createTrayDataSender does not re-deliver when the setting is unchanged', () => {
    const { send, sender } = buildTrayDataSender(true);
    sender.send(buildTrayData());

    sender.syncHideValue();

    expect(send).toHaveBeenCalledTimes(1);
  });

  test('createTrayDataSender has nothing to re-deliver before the first payload', () => {
    const { state, send, sender } = buildTrayDataSender(false);

    state.hideValue = true;
    sender.syncHideValue();

    expect(send).not.toHaveBeenCalled();
  });

  test('createTrayDataSender re-delivers the last good payload, not an error placeholder', () => {
    const { state, send, sender } = buildTrayDataSender(false);
    sender.send(buildTrayData());
    // Main keeps its previous cache for error placeholders, so the tray never
    // shows them.
    sender.send(
      buildTrayData({
        isError: true,
        totalBalance: { amount: '0.00', currency: 'usd', symbol: '$' },
      }),
    );

    state.hideValue = true;
    sender.syncHideValue();

    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2][0]).toEqual(buildTrayData({ hideValue: true }));
  });

  test('createTrayDataSender does not re-deliver the locked placeholder', () => {
    const { state, send, sender } = buildTrayDataSender(false);
    sender.send(buildTrayData({ isLocked: true }));

    state.hideValue = true;
    sender.syncHideValue();

    expect(send).toHaveBeenCalledTimes(1);
  });

  test('createTrayDataSender forgets the last payload on reset', () => {
    const { state, send, sender } = buildTrayDataSender(false);
    sender.send(buildTrayData());

    sender.reset();
    state.hideValue = true;
    sender.syncHideValue();

    expect(send).toHaveBeenCalledTimes(1);
  });
});
