const coldStartBenchmarkMock = jest.fn();
const perfMarkMock = jest.fn();

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    perp: {
      hyperliquid: {
        coldStartBenchmark: coldStartBenchmarkMock,
      },
    },
  },
}));

jest.mock('./mark', () => ({
  perfMark: perfMarkMock,
}));

describe('perpsColdStartPerf', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPerfMonitorEnabled = process.env.PERF_MONITOR_ENABLED;

  beforeEach(() => {
    jest.resetModules();
    coldStartBenchmarkMock.mockReset();
    perfMarkMock.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PERF_MONITOR_ENABLED = originalPerfMonitorEnabled;
  });

  it('writes cold-start benchmark marks to local logs in production without perf monitor', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PERF_MONITOR_ENABLED;

    const { markPerpsColdStartPerf } =
      require('./perpsColdStartPerf') as typeof import('./perpsColdStartPerf');

    markPerpsColdStartPerf('ui_order_book_ready', {
      coin: 'BTC',
      bidLevels: 20,
      askLevels: 20,
    });

    expect(coldStartBenchmarkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'PerpsColdStartBenchmark',
        label: 'ui_order_book_ready',
        elapsed: expect.any(Number),
        sessionId: expect.any(Number),
        detail: {
          coin: 'BTC',
          bidLevels: 20,
          askLevels: 20,
        },
      }),
    );
    expect(perfMarkMock).not.toHaveBeenCalled();
  });

  it('logs a mark only once for markPerpsColdStartPerfOnce', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PERF_MONITOR_ENABLED;

    const { markPerpsColdStartPerfOnce } =
      require('./perpsColdStartPerf') as typeof import('./perpsColdStartPerf');

    markPerpsColdStartPerfOnce('ui_ticker_bar_mark_price_ready');
    markPerpsColdStartPerfOnce('ui_ticker_bar_mark_price_ready');

    expect(coldStartBenchmarkMock).toHaveBeenCalledTimes(1);
  });
});
