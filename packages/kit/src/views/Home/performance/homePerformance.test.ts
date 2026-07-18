import {
  HomePerformanceMonitor,
  isHomeAuthoritativeReady,
} from './homePerformance';

const HOME_ALLOWED_PAYLOAD_KEYS = new Set([
  'cacheState',
  'contentClass',
  'dataCandidateMs',
  'durationMs',
  'errorCode',
  'networkScope',
  'renderer',
  'result',
  'sampleRate',
  'scenario',
  'scopeReadyMs',
  'snapshotAppliedMs',
]);

function expectAllowedPayloadKeys(payload: Record<string, unknown>) {
  expect(Object.keys(payload).sort()).toEqual(
    Object.keys(payload).filter((key) => HOME_ALLOWED_PAYLOAD_KEYS.has(key)).sort(),
  );
}

describe('home performance readiness', () => {
  it('does not treat a temporary initialization empty state as ready', () => {
    expect(
      isHomeAuthoritativeReady({
        dataCandidateReady: false,
        scopeReady: false,
        shellInteractive: true,
        temporaryEmpty: true,
      }),
    ).toBe(false);
  });

  it.each(['authoritative empty', 'unbacked wallet', 'no wallet'])(
    'allows %s after the state is authoritative',
    () => {
      expect(
        isHomeAuthoritativeReady({
          dataCandidateReady: true,
          scopeReady: true,
          shellInteractive: true,
          temporaryEmpty: false,
        }),
      ).toBe(true);
    },
  );

  it('reports only allowed home terminal payload keys', () => {
    jest.useFakeTimers();
    const reporter = jest.fn();
    const monitor = new HomePerformanceMonitor(reporter);

    monitor.enter();
    monitor.scopeReady({
      networkScope: 'single_network',
      scopeKey: 'wallet:account:network',
    });
    monitor.dataCandidate({
      cacheState: 'hit',
      contentClass: 'normal',
      snapshotApplied: true,
    });
    monitor.setShellInteractive(true);

    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    jest.advanceTimersByTime(300);

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0]).toBe('homePerfReady');
    expectAllowedPayloadKeys(reporter.mock.calls[0][1]);
    monitor.leave();
    jest.useRealTimers();
  });
});
