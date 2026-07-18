import { OneKeyLocalError } from '../errors';

import {
  type IPerformanceJourneyTerminalInfo,
  PERFORMANCE_JOURNEY_TIMEOUTS,
  PerformanceJourneyManager,
} from './journey';

const perfMarkMock = jest.fn();

jest.mock('./mark', () => ({
  perfMark: (...args: unknown[]) => {
    perfMarkMock(...args);
  },
}));

describe('PerformanceJourney', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPerfMonitor = process.env.PERF_MONITOR;
  const originalPerfMonitorEnabled = process.env.PERF_MONITOR_ENABLED;
  let now = 0;
  let performanceNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    performanceNowSpy = jest
      .spyOn(globalThis.performance, 'now')
      .mockImplementation(() => now);
    perfMarkMock.mockReset();
    process.env.NODE_ENV = 'production';
    delete process.env.PERF_MONITOR;
    delete process.env.PERF_MONITOR_ENABLED;
  });

  afterEach(() => {
    performanceNowSpy.mockRestore();
    jest.useRealTimers();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PERF_MONITOR = originalPerfMonitor;
    process.env.PERF_MONITOR_ENABLED = originalPerfMonitorEnabled;
  });

  it('emits success terminal exactly once', () => {
    const onTerminal: jest.MockedFunction<
      (info: IPerformanceJourneyTerminalInfo) => void
    > = jest.fn();
    const journey = new PerformanceJourneyManager().start({
      markPrefix: 'TestPerf',
      onTerminal,
      random: () => 0,
      timeoutMs: 1000,
    });

    now = 120;
    expect(journey.succeed()).toBe(true);
    expect(journey.succeed()).toBe(false);
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'success', durationMs: 120 }),
    );
  });

  it.each(['timeout', 'error', 'cancelled'] as const)(
    'keeps %s mutually exclusive with success',
    (terminal) => {
      const onTerminal = jest.fn();
      const journey = new PerformanceJourneyManager().start({
        markPrefix: 'TestPerf',
        onTerminal,
        timeoutMs: 1000,
      });

      now = 50;
      journey.finish(terminal);
      expect(journey.succeed()).toBe(false);
      expect(onTerminal).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ state: terminal }),
      );
    },
  );

  it('invalidates callbacks from the previous generation', () => {
    const onTerminal: jest.MockedFunction<
      (info: IPerformanceJourneyTerminalInfo) => void
    > = jest.fn();
    const manager = new PerformanceJourneyManager();
    const first = manager.start({
      markPrefix: 'TestPerf',
      onTerminal,
      timeoutMs: 1000,
    });
    const second = manager.start({
      markPrefix: 'TestPerf',
      onTerminal,
      timeoutMs: 1000,
    });

    expect(first.state).toBe('cancelled');
    expect(first.succeed()).toBe(false);
    expect(manager.isCurrent(second)).toBe(true);
    expect(second.succeed()).toBe(true);
    expect(onTerminal.mock.calls.map(([info]) => info.state)).toEqual([
      'cancelled',
      'success',
    ]);
  });

  it('clears timers and registered listeners on terminal', () => {
    const cleanup = jest.fn();
    const onTerminal = jest.fn();
    const journey = new PerformanceJourneyManager().start({
      markPrefix: 'TestPerf',
      onTerminal,
      timeoutMs: 1000,
    });
    journey.addCleanup(cleanup);

    journey.succeed();
    now = 2000;
    jest.advanceTimersByTime(2000);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it('samples success at 10 percent and error/timeout at 100 percent', () => {
    const terminalInfo: Array<{ sampled: boolean; sampleRate: number }> = [];
    const manager = new PerformanceJourneyManager();
    manager
      .start({
        markPrefix: 'TestPerf',
        onTerminal: (info) => terminalInfo.push(info),
        random: () => 0.11,
        timeoutMs: 1000,
      })
      .succeed();
    manager
      .start({
        markPrefix: 'TestPerf',
        onTerminal: (info) => terminalInfo.push(info),
        random: () => 0.99,
        timeoutMs: 1000,
      })
      .error();
    const timeoutJourney = manager.start({
      markPrefix: 'TestPerf',
      onTerminal: (info) => terminalInfo.push(info),
      random: () => 0.99,
      timeoutMs: 1000,
    });
    now = 1000;
    jest.advanceTimersByTime(1000);

    expect(timeoutJourney.state).toBe('timeout');
    expect(terminalInfo).toEqual([
      expect.objectContaining({ sampled: false, sampleRate: 0.1 }),
      expect.objectContaining({ sampled: true, sampleRate: 1 }),
      expect.objectContaining({ sampled: true, sampleRate: 1 }),
    ]);
  });

  it.each([
    ['test environment', 'test', undefined, undefined],
    ['PERF_MONITOR', 'production', '1', undefined],
    ['PERF_MONITOR_ENABLED', 'production', undefined, '1'],
  ])('forces sampling in %s', (_label, nodeEnv, monitor, monitorEnabled) => {
    process.env.NODE_ENV = nodeEnv;
    process.env.PERF_MONITOR = monitor;
    process.env.PERF_MONITOR_ENABLED = monitorEnabled;
    const onTerminal = jest.fn();

    new PerformanceJourneyManager()
      .start({
        markPrefix: 'TestPerf',
        onTerminal,
        random: () => 0.99,
        timeoutMs: 1000,
      })
      .succeed();

    expect(onTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ sampled: true, sampleRate: 1 }),
    );
  });

  it('isolates mark, cleanup, and terminal callback failures', () => {
    perfMarkMock.mockImplementation(() => {
      throw new OneKeyLocalError('mark failed');
    });
    const journey = new PerformanceJourneyManager().start({
      markPrefix: 'TestPerf',
      onTerminal: () => {
        throw new OneKeyLocalError('report failed');
      },
      timeoutMs: 1000,
    });
    journey.addCleanup(() => {
      throw new OneKeyLocalError('cleanup failed');
    });

    expect(() => {
      journey.mark('stage');
      journey.succeed();
    }).not.toThrow();
  });

  it('keeps timeout constants centralized', () => {
    expect(PERFORMANCE_JOURNEY_TIMEOUTS).toEqual({
      home: 15_000,
      market: 20_000,
      swapQuote: 30_000,
    });
  });
});
