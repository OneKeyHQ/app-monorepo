/* eslint-disable import/first */

const mockRuntimeHealthCensus = jest.fn<void, [Record<string, unknown>]>();
jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        runtimeHealthCensus: (report: Record<string, unknown>) => {
          mockRuntimeHealthCensus(report);
        },
      },
    },
  },
}));

import { OneKeyLocalError } from '../../errors';

import {
  createDistinctChangeCounter,
  startRuntimeHealthCensus,
  stopRuntimeHealthCensus,
} from './jsBlockCollector';

type IHermesGlobal = {
  HermesInternal?: { getInstrumentedStats?: () => Record<string, unknown> };
};

const MB = 1024 * 1024;

describe('createDistinctChangeCounter', () => {
  it('counts a change once however often the new key is repeated', () => {
    const counter = createDistinctChangeCounter();

    counter.observe('wallet-a|account-0');
    counter.observe('wallet-a|account-0');
    expect(counter.getCount()).toBe(0);

    counter.observe('wallet-a|account-1');
    counter.observe('wallet-a|account-1');
    counter.observe('wallet-a|account-1');
    expect(counter.getCount()).toBe(1);

    counter.observe('wallet-a|account-0');
    expect(counter.getCount()).toBe(2);
  });
});

describe('startRuntimeHealthCensus', () => {
  let now = 0;
  let nowSpy: jest.SpyInstance;

  // Advance wall time and the timer queue together, as an idle loop would.
  const runIdle = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      now += 100;
      jest.advanceTimersByTime(100);
    }
  };
  // The loop was busy: wall time moves on, the next tick fires late.
  const block = (ms: number) => {
    now += ms;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now);
    mockRuntimeHealthCensus.mockClear();
  });

  afterEach(() => {
    stopRuntimeHealthCensus();
    delete (globalThis as IHermesGlobal).HermesInternal;
    nowSpy.mockRestore();
    jest.useRealTimers();
  });

  it('reports one line per window and nothing in between', () => {
    startRuntimeHealthCensus();

    runIdle(29_900);
    expect(mockRuntimeHealthCensus).not.toHaveBeenCalled();

    runIdle(100);
    expect(mockRuntimeHealthCensus).toHaveBeenCalledTimes(1);
    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      windowMs: 30_000,
      blockCount: 0,
      blockTotalMs: 0,
      blockMaxMs: 0,
      suspendedCount: 0,
    });

    runIdle(30_000);
    expect(mockRuntimeHealthCensus).toHaveBeenCalledTimes(2);
  });

  it('measures how long the event loop was blocked and resets per window', () => {
    startRuntimeHealthCensus();

    runIdle(1000);
    block(300);
    runIdle(1000);
    block(700);
    runIdle(1000);
    block(1200);
    runIdle(1000);
    // Below the threshold: ordinary timer jitter.
    block(120);
    runIdle(30_000);

    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      blockCount: 3,
      blockTotalMs: 2200,
      blockMaxMs: 1200,
      blockOver500: 2,
      blockOver1000: 1,
    });

    runIdle(30_000);
    expect(mockRuntimeHealthCensus.mock.calls[1][0]).toMatchObject({
      blockCount: 0,
      blockTotalMs: 0,
      blockMaxMs: 0,
    });
  });

  it('does not mistake a suspended app for a blocked event loop', () => {
    startRuntimeHealthCensus();

    runIdle(10_000);
    block(60_000);
    runIdle(20_000);

    expect(mockRuntimeHealthCensus).toHaveBeenCalledTimes(1);
    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      windowMs: 30_000,
      blockCount: 0,
      suspendedCount: 1,
    });
  });

  it('reports the heap and what the collector did during the window', () => {
    const stats = {
      js_numGCs: 10,
      js_gcTime: 0.5,
      js_heapSize: 150 * MB,
      js_totalAllocatedBytes: 1000 * MB,
    };
    (globalThis as IHermesGlobal).HermesInternal = {
      getInstrumentedStats: () => ({ ...stats }),
    };
    startRuntimeHealthCensus();

    stats.js_numGCs = 14;
    stats.js_gcTime = 0.62;
    stats.js_heapSize = 180 * MB;
    stats.js_totalAllocatedBytes = 1090 * MB;
    runIdle(30_000);

    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      heapMB: 180,
      allocatedMB: 90,
      gcCount: 4,
      gcMs: 120,
    });
  });

  it('leaves the heap fields out where the engine has no counters', () => {
    startRuntimeHealthCensus();
    runIdle(30_000);

    const report = mockRuntimeHealthCensus.mock.calls[0][0];
    expect(report).not.toHaveProperty('heapMB');
    expect(report).not.toHaveProperty('gcMs');
  });

  it('folds the process samples and the caller fields into the line', async () => {
    const samples = [
      { cpu: 40, rss: 800 * MB, uiFps: 60, jsFps: 58 },
      { cpu: 120, rss: 900 * MB, uiFps: 0, jsFps: 21 },
      { cpu: 20, rss: 850 * MB, uiFps: 59, jsFps: 60 },
    ];
    const sampleProcess = jest.fn(
      async () => samples.shift() ?? { cpu: 0, rss: 850 * MB },
    );
    let accountSwitches = 0;
    startRuntimeHealthCensus({
      sampleProcess,
      getExtra: () => ({ accountSwitches }),
    });

    for (let i = 0; i < 3; i += 1) {
      runIdle(5000);
      // Let the sample promise settle, as it would between real ticks.
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    // Later samples report an idle process.
    samples.length = 0;
    accountSwitches = 2;
    sampleProcess.mockImplementation(async () => ({
      cpu: 20,
      rss: 850 * MB,
      uiFps: 59,
      jsFps: 60,
    }));
    for (let i = 0; i < 3; i += 1) {
      runIdle(5000);
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }

    expect(mockRuntimeHealthCensus).toHaveBeenCalledTimes(1);
    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      cpuMax: 120,
      rssMB: 850,
      // A zero frame rate is the sampler warming up, not a frozen screen.
      uiFpsMin: 59,
      jsFpsMin: 21,
      accountSwitches: 2,
    });
  });

  it('keeps reporting when a process sample fails', async () => {
    startRuntimeHealthCensus({
      sampleProcess: () =>
        Promise.reject(new OneKeyLocalError('native sampler unavailable')),
    });

    for (let i = 0; i < 6; i += 1) {
      runIdle(5000);
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }

    expect(mockRuntimeHealthCensus).toHaveBeenCalledTimes(1);
    expect(mockRuntimeHealthCensus.mock.calls[0][0]).not.toHaveProperty(
      'cpuAvg',
    );
  });
});
