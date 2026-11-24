import {
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
  spotActiveAssetAtom,
  spotActiveAssetCtxAtom,
  tradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  PERPS_MARKET_DATA_STALE_MS,
  getPerpsMarketDataBlockedMessageIds,
  getPerpsMarketDataFreshness,
  isPerpsMarketOfInstrument,
  isPerpsOrderFormDataOfInstrument,
  shouldBlockPerpsTradingForMarketData,
  shouldNotifyPerpsNetworkIssue,
  withPerpsMarketOfInstrument,
} from './perpsMarketDataFreshness';

const nowMs = 1_000_000;

describe('perpsMarketDataFreshness', () => {
  it('blocks trading until the websocket is open and a fresh market message arrived', () => {
    expect(
      getPerpsMarketDataFreshness({
        isWebSocketConnected: false,
        networkConnected: undefined,
        lastMessageAt: null,
        nowMs,
      }),
    ).toEqual(
      expect.objectContaining({
        isReady: false,
        isStale: true,
        reason: 'socket_not_open',
      }),
    );

    expect(
      getPerpsMarketDataFreshness({
        isWebSocketConnected: true,
        networkConnected: true,
        lastMessageAt: null,
        nowMs,
      }),
    ).toEqual(
      expect.objectContaining({
        isReady: false,
        isStale: true,
        reason: 'no_message',
      }),
    );
  });

  it('marks market data stale once the last message exceeds the ttl', () => {
    expect(
      getPerpsMarketDataFreshness({
        isWebSocketConnected: true,
        networkConnected: true,
        lastMessageAt: nowMs - PERPS_MARKET_DATA_STALE_MS,
        nowMs,
      }),
    ).toEqual(
      expect.objectContaining({
        isReady: true,
        isStale: false,
        reason: 'ready',
        ageMs: PERPS_MARKET_DATA_STALE_MS,
      }),
    );

    expect(
      getPerpsMarketDataFreshness({
        isWebSocketConnected: true,
        networkConnected: true,
        lastMessageAt: nowMs - PERPS_MARKET_DATA_STALE_MS - 1,
        nowMs,
      }),
    ).toEqual(
      expect.objectContaining({
        isReady: false,
        isStale: true,
        reason: 'stale',
        ageMs: PERPS_MARKET_DATA_STALE_MS + 1,
      }),
    );

    expect(
      shouldNotifyPerpsNetworkIssue(
        getPerpsMarketDataFreshness({
          isWebSocketConnected: true,
          networkConnected: true,
          lastMessageAt: nowMs - PERPS_MARKET_DATA_STALE_MS - 1,
          nowMs,
        }),
      ),
    ).toBe(true);
  });

  it('does not notify while the first market message is still pending', () => {
    const freshness = getPerpsMarketDataFreshness({
      isWebSocketConnected: true,
      networkConnected: true,
      lastMessageAt: null,
      nowMs,
    });

    expect(shouldNotifyPerpsNetworkIssue(freshness)).toBe(false);
    expect(shouldBlockPerpsTradingForMarketData(freshness)).toBe(true);
  });

  it('notifies once the service reports a confirmed network disconnect', () => {
    const freshness = getPerpsMarketDataFreshness({
      isWebSocketConnected: false,
      networkConnected: false,
      lastMessageAt: nowMs - 1000,
      nowMs,
    });

    expect(freshness).toEqual(
      expect.objectContaining({
        isReady: false,
        isStale: true,
        reason: 'network_disconnected',
      }),
    );
    expect(shouldNotifyPerpsNetworkIssue(freshness)).toBe(true);
  });

  it.each([
    {
      label: 'socket is not open',
      freshness: getPerpsMarketDataFreshness({
        isWebSocketConnected: false,
        networkConnected: undefined,
        lastMessageAt: null,
        nowMs,
      }),
    },
    {
      label: 'first message is pending',
      freshness: getPerpsMarketDataFreshness({
        isWebSocketConnected: true,
        networkConnected: true,
        lastMessageAt: null,
        nowMs,
      }),
    },
    {
      label: 'network disconnected',
      freshness: getPerpsMarketDataFreshness({
        isWebSocketConnected: false,
        networkConnected: false,
        lastMessageAt: nowMs - 1000,
        nowMs,
      }),
    },
    {
      label: 'market data is stale',
      freshness: getPerpsMarketDataFreshness({
        isWebSocketConnected: true,
        networkConnected: true,
        lastMessageAt: nowMs - PERPS_MARKET_DATA_STALE_MS - 1,
        nowMs,
      }),
    },
  ])('blocks trading while $label', ({ freshness }) => {
    expect(shouldBlockPerpsTradingForMarketData(freshness)).toBe(true);
  });

  it('allows trading only after a fresh market message arrives', () => {
    const freshness = getPerpsMarketDataFreshness({
      isWebSocketConnected: true,
      networkConnected: true,
      lastMessageAt: nowMs - 1000,
      nowMs,
    });

    expect(shouldBlockPerpsTradingForMarketData(freshness)).toBe(false);
  });
});

describe('the market of the order form', () => {
  const ready = getPerpsMarketDataFreshness({
    isWebSocketConnected: true,
    networkConnected: true,
    lastMessageAt: nowMs,
    nowMs,
  });
  const btc = { mode: 'perp', coin: 'BTC', assetId: 0 } as const;
  const hypeSpot = { mode: 'spot', coin: '@107', assetId: 10_107 } as const;

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['its own perp token', btc, 'perp', 'BTC', '', true],
    [
      'its own perp token before any mode was set',
      btc,
      undefined,
      'BTC',
      '',
      true,
    ],
    ['another perp token', btc, 'perp', 'SOL', '', false],
    ['a spot token', btc, 'spot', 'BTC', '@107', false],
    ['its own spot token', hypeSpot, 'spot', 'BTC', '@107', true],
    ['another spot token', hypeSpot, 'spot', 'BTC', '@150', false],
    ['a perp token', hypeSpot, 'perp', '@107', '@107', false],
  ] as const)(
    'tells a page from a market on %s',
    (_label, instrument, mode, perpCoin, spotCoin, expected) => {
      expect(
        isPerpsMarketOfInstrument({ instrument, mode, perpCoin, spotCoin }),
      ).toBe(expected);
    },
  );

  it('holds the order form back while the market is on another token, with its own message', () => {
    expect(withPerpsMarketOfInstrument(ready, true)).toBe(ready);

    const blocked = withPerpsMarketOfInstrument(ready, false);
    expect(blocked).toMatchObject({ isReady: false, reason: 'other_market' });
    expect(shouldBlockPerpsTradingForMarketData(blocked)).toBe(true);
    // Not a network issue: nothing to notify about.
    expect(shouldNotifyPerpsNetworkIssue(blocked)).toBe(false);
    expect(getPerpsMarketDataBlockedMessageIds(blocked)).toEqual({
      title: ETranslations.target_market_data_changed__msg,
    });
  });

  it('keeps the network reason of market data that is not flowing', () => {
    const offline = getPerpsMarketDataFreshness({
      isWebSocketConnected: false,
      networkConnected: true,
      lastMessageAt: nowMs,
      nowMs,
    });

    expect(withPerpsMarketOfInstrument(offline, false)).toBe(offline);
    expect(getPerpsMarketDataBlockedMessageIds(offline)).toEqual({
      title: ETranslations.perp_offline,
      message: ETranslations.perps_offline_moblie,
    });
  });

  // What the shared atoms hold when an order is confirmed.
  function mockMarket({
    mode = 'perp',
    perpCoin = 'BTC',
    perpAssetId = 0,
    quoteCoin,
    sizeDataCoin,
    spotCoin = '',
    spotAssetId,
    spotQuoteCoin,
  }: {
    mode?: 'perp' | 'spot';
    perpCoin?: string;
    perpAssetId?: number;
    quoteCoin?: string;
    sizeDataCoin?: string;
    spotCoin?: string;
    spotAssetId?: number;
    spotQuoteCoin?: string;
  }) {
    const as = <T>(value: unknown) => value as T;
    jest.spyOn(tradingModeAtom, 'get').mockResolvedValue(mode);
    jest
      .spyOn(perpsActiveAssetAtom, 'get')
      .mockResolvedValue(as({ coin: perpCoin, assetId: perpAssetId }));
    jest
      .spyOn(spotActiveAssetAtom, 'get')
      .mockResolvedValue(as({ coin: spotCoin, assetId: spotAssetId }));
    jest
      .spyOn(perpsActiveAssetCtxAtom, 'get')
      .mockResolvedValue(as(quoteCoin ? { coin: quoteCoin } : undefined));
    jest
      .spyOn(perpsActiveAssetDataAtom, 'get')
      .mockResolvedValue(as(sizeDataCoin ? { coin: sizeDataCoin } : undefined));
    jest
      .spyOn(spotActiveAssetCtxAtom, 'get')
      .mockResolvedValue(
        as(spotQuoteCoin ? { coin: spotQuoteCoin } : undefined),
      );
  }

  it.each([
    ['everything is its own', {}, true],
    [
      'its quote and size data are in',
      { quoteCoin: 'BTC', sizeDataCoin: 'BTC' },
      true,
    ],
    [
      'the market is on another token',
      { perpCoin: 'SOL', perpAssetId: 5 },
      false,
    ],
    ['the market is on spot', { mode: 'spot', spotCoin: '@107' }, false],
    ['the asset is another one of that name', { perpAssetId: 7 }, false],
    ["the quote is another token's", { quoteCoin: 'SOL' }, false],
    ["the size data is another token's", { sizeDataCoin: 'SOL' }, false],
  ] as const)(
    'takes a perp order when %s: %s',
    async (_label, market, expected) => {
      mockMarket(market);

      await expect(isPerpsOrderFormDataOfInstrument(btc)).resolves.toBe(
        expected,
      );
    },
  );

  it.each([
    [
      'its own',
      { spotCoin: '@107', spotAssetId: 10_107, spotQuoteCoin: '@107' },
      true,
    ],
    ["another spot token's", { spotCoin: '@150', spotAssetId: 10_150 }, false],
    [
      "its own but the quote another token's",
      { spotCoin: '@107', spotAssetId: 10_107, spotQuoteCoin: '@150' },
      false,
    ],
  ] as const)(
    'takes a spot order when the market is %s: %s',
    async (_label, market, expected) => {
      mockMarket({ mode: 'spot', ...market });

      await expect(isPerpsOrderFormDataOfInstrument(hypeSpot)).resolves.toBe(
        expected,
      );
    },
  );
});
