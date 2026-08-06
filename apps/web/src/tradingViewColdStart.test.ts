/** @jest-environment jsdom */

const TRADING_VIEW_URL = 'https://tradingview.onekey.so/';

function setConnection(connection: {
  effectiveType?: string;
  saveData?: boolean;
}) {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: connection,
  });
}

describe('TradingView web cold start', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    setConnection({ effectiveType: '4g', saveData: false });
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('preconnects once and starts the offscreen chart during idle time', () => {
    let idleCallback: (() => void) | undefined;
    const requestIdleCallback = jest.fn((callback: () => void) => {
      idleCallback = callback;
      return 7;
    });
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallback,
    });

    const { preconnectTradingView, scheduleTradingViewColdStartWarmup } =
      require('./tradingViewColdStart') as typeof import('./tradingViewColdStart');

    preconnectTradingView(TRADING_VIEW_URL);
    preconnectTradingView(TRADING_VIEW_URL);
    scheduleTradingViewColdStartWarmup(TRADING_VIEW_URL);

    expect(
      document.head.querySelectorAll('[data-onekey-trading-view-preconnect]'),
    ).toHaveLength(2);
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 2000,
    });

    expect(idleCallback).toBeDefined();
    idleCallback?.();

    const iframe = document.body.querySelector<HTMLIFrameElement>(
      '[data-onekey-trading-view-warmup="true"]',
    );
    expect(iframe).not.toBeNull();
    const warmupUrl = new URL(iframe?.src ?? '');
    expect(warmupUrl.searchParams.get('platform')).toBe('web');
    expect(warmupUrl.searchParams.get('type')).toBe('market');
    expect(warmupUrl.searchParams.get('symbol')).toBe('crypto');

    iframe?.dispatchEvent(new Event('load'));
    jest.advanceTimersByTime(14_999);
    expect(iframe?.isConnected).toBe(true);
    jest.advanceTimersByTime(1);
    expect(iframe?.isConnected).toBe(false);
  });

  it('does not speculatively load the chart when data saver is enabled', () => {
    setConnection({ effectiveType: '4g', saveData: true });
    const { startTradingViewColdStartWarmup } =
      require('./tradingViewColdStart') as typeof import('./tradingViewColdStart');

    startTradingViewColdStartWarmup(TRADING_VIEW_URL);

    expect(
      document.body.querySelector('[data-onekey-trading-view-warmup]'),
    ).toBeNull();
  });
});
