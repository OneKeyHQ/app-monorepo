import {
  PERPS_MARKET_DATA_STALE_MS,
  getPerpsMarketDataFreshness,
  shouldBlockPerpsTradingForMarketData,
  shouldNotifyPerpsNetworkIssue,
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
