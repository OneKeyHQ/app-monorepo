/* eslint-disable import/first */

const mockRuntimeHealthCensus = jest.fn<void, [Record<string, unknown>]>();
const mockMainInboundCensus = jest.fn<void, [Record<string, unknown>]>();
let mockVisibilityListener: ((visible: boolean) => void) | undefined;
jest.mock('../../utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    mockVisibilityListener = listener;
    return () => {
      mockVisibilityListener = undefined;
    };
  },
}));
jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        runtimeHealthCensus: (report: Record<string, unknown>) => {
          mockRuntimeHealthCensus(report);
        },
        mainInboundCensus: (report: Record<string, unknown>) => {
          mockMainInboundCensus(report);
        },
      },
    },
  },
}));

import { OneKeyLocalError } from '../../errors';

import {
  createDistinctChangeCounter,
  recordInboundFromBackground,
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
    mockMainInboundCensus.mockClear();
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
    mockVisibilityListener?.(false);
    block(60_000);
    mockVisibilityListener?.(true);
    runIdle(20_000);

    expect(mockRuntimeHealthCensus).toHaveBeenCalledTimes(1);
    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      windowMs: 30_000,
      blockCount: 0,
      suspendedCount: 1,
    });
  });

  it('counts long foreground stalls instead of guessing suspension', () => {
    startRuntimeHealthCensus();
    runIdle(1000);
    block(6000);
    runIdle(30_000);
    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      blockMaxMs: 6000,
      blockTotalMs: 6000,
      blockOver1000: 1,
      suspendedCount: 0,
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

  it('separates Hades generations, lifetime timing and current heap gauges', () => {
    const stats = {
      js_numGCs: 20,
      js_gcTime: 1,
      js_avgGCTime: 0.05,
      js_maxGCTime: 0.2,
      js_heapSize: 200 * MB,
      js_allocatedBytes: 80 * MB,
      js_externalBytes: 12 * MB,
      js_totalAllocatedBytes: 1000 * MB,
      js_gcSpecific: {
        js_numYGCollections: 18,
        js_numOGCollections: 2,
        js_numCompactions: 1,
      },
    };
    (globalThis as IHermesGlobal).HermesInternal = {
      getInstrumentedStats: () => stats,
    };
    startRuntimeHealthCensus();
    stats.js_numGCs = 24;
    stats.js_gcTime = 1.12;
    stats.js_totalAllocatedBytes = 1090 * MB;
    stats.js_gcSpecific.js_numYGCollections = 21;
    stats.js_gcSpecific.js_numOGCollections = 3;
    runIdle(30_000);

    expect(mockRuntimeHealthCensus.mock.calls[0][0]).toMatchObject({
      youngGCCount: 3,
      oldGCCount: 1,
      compactionCount: 0,
      allocationMBPerSec: 3,
      gcMaxLifetimeMs: 200,
      gcAvgLifetimeMs: 50,
      liveMB: 80,
      heapMB: 200,
      externalMB: 12,
      js_numYGCollections: 21,
      js_numOGCollections: 3,
      js_numCompactions: 1,
    });
    expect(mockRuntimeHealthCensus.mock.calls[0][0].gcAvgMs).toBeCloseTo(30);
    expect(mockRuntimeHealthCensus.mock.calls[0][0]).not.toHaveProperty(
      'gcMaxMs',
    );
  });

  it('keeps unavailable generation counters unknown instead of zero', () => {
    (globalThis as IHermesGlobal).HermesInternal = {
      getInstrumentedStats: () => ({
        js_numGCs: 1,
        js_gcTime: 0.01,
        js_heapSize: MB,
        js_totalAllocatedBytes: MB,
        js_maxGCTime: Number.NaN,
      }),
    };
    startRuntimeHealthCensus();
    runIdle(30_000);
    const report = mockRuntimeHealthCensus.mock.calls[0][0];
    expect(report.youngGCCount).toBeUndefined();
    expect(report.oldGCCount).toBeUndefined();
    expect(report.compactionCount).toBeUndefined();
    expect(report.gcMaxLifetimeMs).toBeUndefined();
    expect(report.gcAvgMs).toBe(0);
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

describe('recordInboundFromBackground', () => {
  let now = 0;
  let nowSpy: jest.SpyInstance;

  const runIdle = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      now += 100;
      jest.advanceTimersByTime(100);
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now);
    mockMainInboundCensus.mockClear();
    mockRuntimeHealthCensus.mockClear();
    startRuntimeHealthCensus();
  });

  afterEach(() => {
    stopRuntimeHealthCensus();
    // Drain whatever the test recorded so it cannot leak into the next one.
    startRuntimeHealthCensus();
    runIdle(30_000);
    stopRuntimeHealthCensus();
    nowSpy.mockRestore();
    jest.useRealTimers();
  });

  it('totals what each sender pushed, biggest first', () => {
    recordInboundFromBackground({ kind: 'rpc', name: 'a.big', chars: 40_960 });
    recordInboundFromBackground({ kind: 'rpc', name: 'a.big', chars: 40_960 });
    recordInboundFromBackground({ kind: 'rpc', name: 'b.small', chars: 1024 });
    recordInboundFromBackground({
      kind: 'atom',
      name: 'someAtom',
      chars: 2048,
    });
    recordInboundFromBackground({
      kind: 'event',
      name: 'SomeEvent',
      chars: 512,
    });
    runIdle(30_000);

    expect(mockMainInboundCensus).toHaveBeenCalledTimes(1);
    const report = mockMainInboundCensus.mock.calls[0][0] as {
      total: number;
      totalKB: number;
      byKind: { kind: string; count: number; kb: number }[];
      bySender: { sender: string; count: number; kb: number }[];
    };
    expect(report.total).toBe(5);
    expect(report.totalKB).toBe(84);
    expect(report.byKind).toEqual([
      { kind: 'rpc', count: 3, kb: 81 },
      { kind: 'atom', count: 1, kb: 2 },
      { kind: 'event', count: 1, kb: 1 },
    ]);
    expect(report.bySender[0]).toEqual({
      sender: 'rpc:a.big',
      count: 2,
      kb: 80,
    });
  });

  it('says nothing in a window where the background pushed nothing', () => {
    runIdle(30_000);

    expect(mockMainInboundCensus).not.toHaveBeenCalled();
    expect(mockRuntimeHealthCensus).toHaveBeenCalledTimes(1);
  });

  it('starts each window from zero', () => {
    recordInboundFromBackground({ kind: 'rpc', name: 'a', chars: 1024 });
    runIdle(30_000);
    recordInboundFromBackground({ kind: 'rpc', name: 'b', chars: 2048 });
    runIdle(30_000);

    expect(mockMainInboundCensus).toHaveBeenCalledTimes(2);
    expect(
      (mockMainInboundCensus.mock.calls[1][0] as { bySender: unknown[] })
        .bySender,
    ).toEqual([{ sender: 'rpc:b', count: 1, kb: 2 }]);
  });

  it('keeps a sender that mints unique names from growing the table', () => {
    for (let i = 0; i < 500; i += 1) {
      recordInboundFromBackground({
        kind: 'event',
        name: `unique-${i}`,
        chars: 1024,
      });
    }
    runIdle(30_000);

    const report = mockMainInboundCensus.mock.calls[0][0] as {
      total: number;
      byKind: { kind: string; count: number }[];
      bySender: { sender: string; count: number }[];
    };
    expect(report.total).toBe(500);
    expect(report.byKind[0].count).toBe(500);
    expect(report.bySender.length).toBeLessThanOrEqual(8);
    expect(
      report.bySender.find((entry) => entry.sender === 'event:others')?.count,
    ).toBeGreaterThan(400);
  });

  it('counts an unnamed payload without dropping its size', () => {
    recordInboundFromBackground({ kind: 'rpc', name: undefined, chars: 3072 });
    runIdle(30_000);

    expect(
      (mockMainInboundCensus.mock.calls[0][0] as { bySender: unknown[] })
        .bySender,
    ).toEqual([{ sender: 'rpc:others', count: 1, kb: 3 }]);
  });

  it('keeps known senders attributed after the distinct-name limit', () => {
    for (let i = 0; i < 100; i += 1) {
      recordInboundFromBackground({ kind: 'rpc', name: `rpc-${i}`, chars: 1 });
    }
    recordInboundFromBackground({ kind: 'rpc', name: 'rpc-0', chars: 4096 });
    runIdle(30_000);
    expect(mockMainInboundCensus.mock.calls[0][0]).toMatchObject({
      total: 101,
      totalChars: 4196,
      bySender: expect.arrayContaining([
        { sender: 'rpc:rpc-0', count: 2, kb: 4 },
      ]),
    });
  });
});
