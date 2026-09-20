/* eslint-disable import/first */

const mockRuntimeHealthCensus = jest.fn<void, [Record<string, unknown>]>();
const mockMainInboundCensus = jest.fn<void, [Record<string, unknown>]>();
const mockDiagCensus = jest.fn<void, [Record<string, unknown>]>();
const mockDiagRanking = jest.fn<void, [Record<string, unknown>]>();
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
        diagCensus: (report: Record<string, unknown>) => {
          mockDiagCensus(report);
        },
        diagRanking: (report: Record<string, unknown>) => {
          mockDiagRanking(report);
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
});

// DIAGNOSTIC BRANCH ONLY.
describe('diag census', () => {
  type IFakeFiber = {
    tag: number;
    flags: number;
    subtreeFlags: number;
    type: unknown;
    alternate: IFakeFiber | null;
    memoizedProps?: unknown;
    child: IFakeFiber | null;
    sibling: IFakeFiber | null;
  };
  type IFakeCensus = {
    commits: number;
    unmounts: number;
    roots: Set<{ current: IFakeFiber | null }>;
    onCommit?: (root: { current: IFakeFiber | null }) => void;
    weakMapSets: number;
    weakMapNewKeys: number;
    weakSetAdds: number;
    weakRefs: number;
    finalizers: number;
    intervalsLive: Set<unknown>;
    intervalsCreated: number;
    timeoutsScheduled: number;
  };
  type IDiagGlobal = { __ONEKEY_DIAG_CENSUS__?: IFakeCensus };

  const PERFORMED_WORK = 1;
  const previous = {} as IFakeFiber;

  // A function component. `how` is what React did with it in this commit.
  const component = (
    name: string,
    how: 'mounted' | 'updated' | 'skipped',
    {
      route,
      children = [],
      staleFlags = false,
    }: { route?: string; children?: IFakeFiber[]; staleFlags?: boolean } = {},
  ): IFakeFiber => {
    children.forEach((child, index) => {
      child.sibling = children[index + 1] ?? null;
    });
    const type = { [name]: () => null }[name];
    return {
      tag: 0,
      flags: how === 'skipped' && !staleFlags ? 0 : PERFORMED_WORK,
      subtreeFlags: children.some(
        (child) => ((child.flags | child.subtreeFlags) & PERFORMED_WORK) !== 0,
      )
        ? PERFORMED_WORK
        : 0,
      type,
      alternate: how === 'mounted' ? null : previous,
      memoizedProps: route ? { route: { name: route } } : {},
      child: children[0] ?? null,
      sibling: null,
    };
  };

  let now = 0;
  let nowSpy: jest.SpyInstance;
  let census: IFakeCensus;

  const commit = (tree: IFakeFiber) => {
    const root = {
      current: { ...component('HostRoot', 'skipped'), tag: 3, child: tree },
    };
    root.current.subtreeFlags = PERFORMED_WORK;
    census.commits += 1;
    census.roots.add(root);
    census.onCommit?.(root);
  };
  const flushWindow = () => {
    for (let elapsed = 0; elapsed < 30_000; elapsed += 100) {
      now += 100;
      jest.advanceTimersByTime(100);
    }
  };
  const ranking = (list: string, window?: number): Record<string, number> => {
    const counts: Record<string, number> = {};
    mockDiagRanking.mock.calls.forEach(([row]) => {
      if (
        row.list === list &&
        (window === undefined || row.window === window)
      ) {
        counts[String(row.name)] = Number(row.count);
      }
    });
    return counts;
  };
  const lastLine = () => mockDiagCensus.mock.calls.at(-1)?.[0] ?? {};

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now);
    mockDiagCensus.mockClear();
    mockDiagRanking.mockClear();
    census = {
      commits: 0,
      unmounts: 0,
      roots: new Set(),
      weakMapSets: 0,
      weakMapNewKeys: 0,
      weakSetAdds: 0,
      weakRefs: 0,
      finalizers: 0,
      intervalsLive: new Set(),
      intervalsCreated: 0,
      timeoutsScheduled: 0,
    };
    (globalThis as IDiagGlobal).__ONEKEY_DIAG_CENSUS__ = census;
    startRuntimeHealthCensus();
  });

  afterEach(() => {
    stopRuntimeHealthCensus();
    delete (globalThis as IDiagGlobal).__ONEKEY_DIAG_CENSUS__;
    nowSpy.mockRestore();
    jest.useRealTimers();
  });

  it('tells opening a screen from re-rendering what is already there', () => {
    commit(
      component('Container', 'updated', {
        children: [
          component('Navigator', 'updated', {
            children: [
              component('SceneView', 'mounted', {
                route: 'MarketDetail',
                children: [
                  component('Header', 'mounted'),
                  component('Chart', 'mounted'),
                ],
              }),
            ],
          }),
        ],
      }),
    );
    flushWindow();

    expect(lastLine()).toMatchObject({
      commits: 1,
      commitsWalked: 1,
      commitsSkipped: 0,
      updateRenders: 2,
      mountRenders: 3,
    });
    expect(ranking('updateRoots')).toEqual({ Container: 2 });
    expect(ranking('mountRoots')).toEqual({ 'screen:MarketDetail': 3 });
  });

  it('charges an update to the screen it happens in, however deep', () => {
    commit(
      component('Navigator', 'skipped', {
        children: [
          component('SceneView', 'skipped', {
            route: 'Home',
            children: [component('HomePage', 'skipped')],
          }),
          component('SceneView', 'skipped', {
            route: 'Swap',
            children: [
              component('SwapMainLoad', 'updated', {
                children: [
                  component('SwapPanel', 'updated'),
                  component('SwapHistory', 'updated'),
                ],
              }),
            ],
          }),
        ],
      }),
    );
    flushWindow();

    expect(ranking('updateRoutes')).toEqual({ Swap: 3 });
    expect(ranking('updateRoots')).toEqual({ SwapMainLoad: 3 });
    expect(lastLine()).toMatchObject({ updateRenders: 3, mountRenders: 0 });
  });

  it('names the screen when something mounts inside one that is already there', () => {
    commit(
      component('SceneView', 'updated', {
        route: 'Home',
        children: [
          component('TokenList', 'updated', {
            children: [
              component('TokenRow', 'mounted', {
                children: [component('TokenIcon', 'mounted')],
              }),
            ],
          }),
        ],
      }),
    );
    flushWindow();

    expect(ranking('mountRoots')).toEqual({ 'Home » TokenRow': 2 });
    expect(ranking('updateRoots')).toEqual({ SceneView: 2 });
  });

  it('gives siblings their own roots', () => {
    commit(
      component('Providers', 'skipped', {
        children: [
          component('ThemeProvider', 'updated', {
            children: [component('ThemedText', 'updated')],
          }),
          component('BannerProvider', 'updated'),
        ],
      }),
    );
    flushWindow();

    expect(ranking('updateRoots')).toEqual({
      ThemeProvider: 2,
      BannerProvider: 1,
    });
  });

  it('adds up a label that comes back after another one interleaved', () => {
    commit(
      component('Navigator', 'skipped', {
        children: [
          component('SceneView', 'skipped', {
            route: 'Home',
            children: [component('HomeHeader', 'updated')],
          }),
          component('SceneView', 'skipped', {
            route: 'Swap',
            children: [component('SwapMainLoad', 'updated')],
          }),
          component('SceneView', 'skipped', {
            route: 'Home',
            children: [
              component('HomeList', 'updated', {
                children: [component('HomeRow', 'updated')],
              }),
            ],
          }),
        ],
      }),
    );
    flushWindow();

    expect(ranking('updateRoutes')).toEqual({ Home: 3, Swap: 1 });
    expect(ranking('updateRoots')).toEqual({
      HomeHeader: 1,
      SwapMainLoad: 1,
      HomeList: 2,
    });
  });

  it('ignores the stale flags of a subtree React bailed out of', () => {
    const staleChild = component('RenderedLastTime', 'skipped', {
      staleFlags: true,
    });
    const bailedOut = component('Memoized', 'skipped', {
      children: [staleChild],
    });
    // React clears subtreeFlags on the fiber it bails out of, not below it.
    bailedOut.subtreeFlags = 0;
    commit(
      component('Parent', 'updated', {
        children: [bailedOut, component('Live', 'updated')],
      }),
    );
    flushWindow();

    expect(lastLine()).toMatchObject({ updateRenders: 2 });
    expect(ranking('updateRoots')).toEqual({ Parent: 2 });
  });

  it('labels an anonymous root with its nearest named ancestor', () => {
    const anonymous = component('ignored', 'updated');
    anonymous.type = () => null;
    commit(component('Screen', 'skipped', { children: [anonymous] }));
    flushWindow();

    expect(ranking('updateRoots')).toEqual({ 'Screen > (anonymous)': 1 });
  });

  it('keeps running totals a script can be compared on, and starts each window from zero', () => {
    const baseline = Number(lastLine().totalUpdateRenders ?? 0);
    commit(component('A', 'updated'));
    commit(component('B', 'mounted'));
    census.weakMapNewKeys = 40;
    census.unmounts = 7;
    flushWindow();
    const first = lastLine();
    const totalsBefore = {
      updates: Number(first.totalUpdateRenders),
      mounts: Number(first.totalMountRenders),
      keys: Number(first.totalWeakMapNewKeys),
      unmounts: Number(first.totalUnmounts),
      commits: Number(first.totalCommits),
    };
    expect(first).toMatchObject({
      commits: 2,
      updateRenders: 1,
      mountRenders: 1,
    });
    expect(totalsBefore.updates).toBeGreaterThanOrEqual(baseline + 1);

    commit(component('A', 'updated'));
    census.weakMapNewKeys = 2;
    flushWindow();
    const second = lastLine();

    expect(second).toMatchObject({
      commits: 1,
      updateRenders: 1,
      mountRenders: 0,
      weakMapNewKeys: 2,
      unmounts: 0,
      totalUpdateRenders: totalsBefore.updates + 1,
      totalMountRenders: totalsBefore.mounts,
      totalWeakMapNewKeys: totalsBefore.keys + 2,
      totalUnmounts: totalsBefore.unmounts,
      totalCommits: totalsBefore.commits + 1,
    });
    expect(ranking('updateRoots', Number(second.window))).toEqual({ A: 1 });
  });

  it('stops walking once a window has spent its budget, and says so', () => {
    // Every clock read moves time on: one walk costs a second here.
    nowSpy.mockImplementation(() => {
      now += 1000;
      return now;
    });
    for (let index = 0; index < 5; index += 1) {
      commit(component('Busy', 'updated'));
    }
    nowSpy.mockImplementation(() => now);
    flushWindow();

    expect(lastLine()).toMatchObject({
      commits: 5,
      commitsWalked: 3,
      commitsSkipped: 2,
      updateRenders: 3,
    });
  });

  it('says nothing without the entry probe', () => {
    stopRuntimeHealthCensus();
    delete (globalThis as IDiagGlobal).__ONEKEY_DIAG_CENSUS__;
    mockDiagCensus.mockClear();
    startRuntimeHealthCensus();
    flushWindow();

    expect(mockDiagCensus).not.toHaveBeenCalled();
  });
});
