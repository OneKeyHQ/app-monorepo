import { MarketChartPerformanceMonitor } from './marketChartPerformance';

const MARKET_ALLOWED_PAYLOAD_KEYS = new Set([
  'durationMs',
  'errorCode',
  'fallbackUsed',
  'firstBarMs',
  'hostLoadedMs',
  'hostRequestedMs',
  'page',
  'paramsReadyMs',
  'priceScaleMs',
  'reloadCount',
  'renderer',
  'result',
  'sampleRate',
  'scenario',
  'sourceClass',
]);

function expectAllowedPayloadKeys(payload: Record<string, unknown>) {
  expect(Object.keys(payload).sort()).toEqual(
    Object.keys(payload)
      .filter((key) => MARKET_ALLOWED_PAYLOAD_KEYS.has(key))
      .sort(),
  );
}

describe('MarketChartPerformanceMonitor', () => {
  it('does not finish a symbol switch until first-bar data acknowledges it', () => {
    const reporter = jest.fn();
    const monitor = new MarketChartPerformanceMonitor({
      page: 'market_detail',
      reporter,
    });

    const initial = monitor.paramsReady('scope-a');
    monitor.firstBarReady(initial, '1m');
    expect(reporter).toHaveBeenCalledTimes(1);

    const switched = monitor.paramsReady('scope-b');
    expect(monitor.hasActiveJourney()).toBe(true);
    expect(reporter).toHaveBeenCalledTimes(1);

    monitor.firstBarReady(switched, '1m');
    expect(reporter).toHaveBeenCalledTimes(2);
    expect(reporter.mock.calls[1][0]).toBe('marketChartPerfSymbolSwitch');
  });

  it('ignores a first-bar callback from an old generation', () => {
    const reporter = jest.fn();
    const monitor = new MarketChartPerformanceMonitor({
      page: 'market_detail',
      reporter,
    });
    const oldToken = monitor.paramsReady('scope-a');
    const newToken = monitor.paramsReady('scope-b');
    reporter.mockClear();

    expect(monitor.firstBarReady(oldToken, '1m')).toBe(false);
    expect(reporter).not.toHaveBeenCalled();
    monitor.firstBarReady(newToken, '1m');
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('reports only allowed market terminal payload keys', () => {
    const reporter = jest.fn();
    const monitor = new MarketChartPerformanceMonitor({
      page: 'market_detail',
      reporter,
    });
    const token = monitor.paramsReady('scope-a');

    monitor.hostRequested(token);
    monitor.hostLoaded(token);
    monitor.sourceChanged(token, 'market_api');
    monitor.firstBarReady(token, '1m');

    expect(reporter).toHaveBeenCalledTimes(1);
    expectAllowedPayloadKeys(reporter.mock.calls[0][1]);
  });
});
