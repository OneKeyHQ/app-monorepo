import { getCurrentPerpsMarketDataFreshness } from './usePerpsMarketDataFreshness';

let mockConnected = true;
let mockSocketOpen = true;
let mockLastMessageAt = 1_000_000;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsNetworkStatusAtom: { atom: () => 'network' },
  perpsWebSocketConnectedAtom: { atom: () => 'socket' },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: {
    get: (atom: string) =>
      atom === 'network'
        ? { connected: mockConnected, lastMessageAt: mockLastMessageAt }
        : mockSocketOpen,
  },
}));

describe('current market readiness at order review and confirmation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    mockConnected = true;
    mockSocketOpen = true;
    mockLastMessageAt = Date.now();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects a quote that expires while confirmation is open without a render', () => {
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    jest.advanceTimersByTime(5001);
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe('stale');

    mockLastMessageAt = Date.now();
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);
  });

  it('checks the latest socket and network state on each press', () => {
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    mockSocketOpen = false;
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe('socket_not_open');

    mockSocketOpen = true;
    mockConnected = false;
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe(
      'network_disconnected',
    );

    mockConnected = true;
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);
  });
});
