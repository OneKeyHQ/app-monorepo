import { OneKeyLocalError } from '../errors';

import {
  AVAILABILITY_MAX_FAILURE_KEYS,
  AVAILABILITY_MIN_SEND_GAP_MS,
  AvailabilityAggregator,
} from './availabilityAggregator';

import type { IAvailabilityAggregatorDeps } from './availabilityAggregator';
import type { IAvailabilitySnapshotParams } from '../logger/scopes/app/types';

jest.mock('../logger/logger', () => ({ defaultLogger: {} }));

const START = Date.UTC(2026, 0, 1, 8);
let nextId = 0;

function createHarness({
  persistWindows = true,
  storage,
}: {
  persistWindows?: boolean;
  storage?: { text?: string | null; loadError?: boolean };
} = {}) {
  const store = storage ?? {};
  const sent: IAvailabilitySnapshotParams[] = [];
  const clock = { now: START };
  const deps: IAvailabilityAggregatorDeps = {
    now: () => clock.now,
    createId: () => {
      nextId += 1;
      return `id-${nextId}`;
    },
    meta: { runtimeScope: 'bg' },
    persistWindows,
    storage: {
      load: async () => {
        if (store.loadError) throw new OneKeyLocalError('read failed');
        return store.text;
      },
      save: async (text) => {
        store.text = text;
      },
    },
    canSend: async () => true,
    send: async (params) => {
      sent.push(params);
    },
  };
  const aggregator = new AvailabilityAggregator(deps);
  const flush = async () => {
    await aggregator.flush('hidden');
    await settle();
  };
  return { aggregator, clock, deps, flush, sent, store };
}

/** Lets storage reads, the flush loop and the send promise all run out. */
async function settle() {
  for (let turn = 0; turn < 8; turn += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('AvailabilityAggregator', () => {
  beforeEach(() => {
    nextId = 0;
  });

  // Not a try/finally inside the test: a test that fails by exceeding the jest
  // timeout never runs its own cleanup, and the fake timers would then stall
  // every later test in the file behind an unrelated timeout.
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends counters, slow counts and failure details in one snapshot', async () => {
    const { aggregator, flush, sent } = createHarness();
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    aggregator.record({
      source: 'api',
      target: 'wallet',
      status: 'timeout',
      durationMs: 30_000,
      failure: { detail: 'sni:/wallet/v1', errorCode: 'econnaborted' },
    });
    aggregator.record({ source: 'api_net', target: 'wifi', status: 'failed' });

    await flush();

    expect(sent).toEqual([
      {
        schemaVersion: 4,
        snapshotId: 'id-1',
        $insertId: 'id-1',
        $timestamp: START,
        runtimeScope: 'bg',
        endpointEnv: 'prod',
        windowStartTs: START,
        windowEndTs: START,
        windowCount: 1,
        api_wallet_ok: 1,
        api_wallet_timeout: 1,
        api_wallet_slow_outcome: 1,
        api_net_wifi_failed: 1,
        failures_1: 'api|wallet|timeout|sni:/wallet/v1|econnaborted=1',
      },
    ]);
  });

  it('marks snapshots that include test environment traffic', async () => {
    const { aggregator, flush, sent } = createHarness();
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    aggregator.record({
      source: 'api',
      target: 'wallet',
      status: 'ok',
      testEndpoint: true,
    });
    await flush();

    expect(sent[0]).toMatchObject({ endpointEnv: 'test', api_wallet_ok: 2 });
  });

  it('sends at most once per gap and never without data', async () => {
    const { aggregator, clock, flush, sent } = createHarness();
    await flush();
    expect(sent).toHaveLength(0);

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await flush();
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    clock.now += AVAILABILITY_MIN_SEND_GAP_MS - 1;
    await flush();
    expect(sent).toHaveLength(1);

    clock.now += 1;
    await flush();
    expect(sent).toHaveLength(2);
  });

  it('keeps the gap across restarts and sends data of every earlier process', async () => {
    const first = createHarness();
    first.aggregator.record({ source: 'api', target: 'swap', status: 'ok' });
    await first.flush();
    first.aggregator.record({ source: 'api', target: 'swap', status: 'ok' });
    await first.flush();
    expect(first.sent).toHaveLength(1);

    const second = createHarness({ storage: first.store });
    second.clock.now = START + 60_000;
    await second.flush();
    second.aggregator.record({ source: 'api', target: 'swap', status: 'ok' });
    await second.flush();
    expect(second.sent).toHaveLength(0);

    const third = createHarness({ storage: first.store });
    third.clock.now = START + AVAILABILITY_MIN_SEND_GAP_MS;
    await third.flush();
    expect(third.sent).toEqual([
      expect.objectContaining({ snapshotId: 'id-2', api_swap_ok: 2 }),
    ]);
  });

  it('stores a window before sending it and resends it unchanged', async () => {
    const first = createHarness();
    first.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    let storedAtSend: string | null | undefined;
    first.deps.send = async () => {
      storedAtSend = first.store.text;
      throw new OneKeyLocalError('killed mid-send');
    };
    await first.flush();
    expect(JSON.parse(String(storedAtSend)).pending.id).toBe('id-1');

    const second = createHarness({ storage: first.store });
    second.aggregator.record({ source: 'api', target: 'earn', status: 'ok' });
    second.clock.now = START + AVAILABILITY_MIN_SEND_GAP_MS;
    await second.flush();
    second.clock.now += AVAILABILITY_MIN_SEND_GAP_MS;
    await second.flush();

    expect(second.sent).toEqual([
      expect.objectContaining({ snapshotId: 'id-1', api_wallet_ok: 1 }),
      expect.objectContaining({ snapshotId: 'id-2', api_earn_ok: 1 }),
    ]);
    expect(second.sent[0]).not.toHaveProperty('api_earn_ok');
  });

  it('shares the send time between instances that do not persist counters', async () => {
    const storage = {};
    const tabA = createHarness({ persistWindows: false, storage });
    const tabB = createHarness({ persistWindows: false, storage });
    tabA.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    tabB.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });

    await tabA.flush();
    await tabB.flush();

    expect(tabA.sent).toHaveLength(1);
    expect(tabB.sent).toHaveLength(0);
    expect(JSON.parse(String(tabA.store.text))).toEqual({
      version: 3,
      lastSendTs: START,
    });
  });

  it('never sends or writes when stored state cannot be read', async () => {
    const { aggregator, flush, sent, store } = createHarness({
      storage: { loadError: true },
    });
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await flush();

    expect(sent).toHaveLength(0);
    expect(store.text).toBeUndefined();
  });

  it('ignores corrupt stored windows and restarts the gap for a future send time', async () => {
    const { aggregator, clock, flush, sent } = createHarness({
      storage: {
        text: JSON.stringify({
          version: 3,
          lastSendTs: START + 10 * AVAILABILITY_MIN_SEND_GAP_MS,
          pending: { id: 'bad', startTs: 1, endTs: 1, counters: null },
        }),
      },
    });
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await flush();
    expect(sent).toHaveLength(0);

    clock.now += AVAILABILITY_MIN_SEND_GAP_MS;
    await flush();
    expect(sent).toEqual([
      expect.objectContaining({ api_wallet_ok: 1, windowCount: 1 }),
    ]);
  });

  it('ignores state stored under the schema whose counters used `_slow`', async () => {
    const { aggregator, flush, sent } = createHarness({
      storage: {
        text: JSON.stringify({
          version: 2,
          lastSendTs: START,
          current: {
            id: 'stored-by-an-older-build',
            startTs: START,
            endTs: START,
            windowCount: 1,
            counters: { api_wallet_ok: 7, api_wallet_slow: 7 },
            failures: {},
            failuresOmitted: 0,
          },
        }),
      },
    });
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await flush();

    // Counters of the two shapes must not merge into one window, so the whole
    // stored state is dropped and the gap restarts.
    expect(sent).toEqual([
      expect.objectContaining({ snapshotId: 'id-1', api_wallet_ok: 1 }),
    ]);
    expect(sent[0]).not.toHaveProperty('api_wallet_slow');
  });

  it('attempts at most one record-driven flush per tick interval', async () => {
    // One flush attempt per request would mean a storage write per request.
    const { aggregator, clock, deps } = createHarness();
    let canSendCalls = 0;
    deps.canSend = async () => {
      canSendCalls += 1;
      return false;
    };

    for (let request = 0; request < 5; request += 1) {
      aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    }
    await settle();
    expect(canSendCalls).toBe(1);

    clock.now += 60_000;
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await settle();
    expect(canSendCalls).toBe(2);
  });

  it('bounds failure details and reports what was omitted', async () => {
    const { aggregator, flush, sent } = createHarness();
    for (let index = 0; index <= AVAILABILITY_MAX_FAILURE_KEYS; index += 1) {
      aggregator.record({
        source: 'api',
        target: 'wallet',
        status: 'network_error',
        failure: { detail: `sni:/route${index}`, errorCode: 'err_network' },
      });
    }
    await flush();

    const texts = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (index) => sent[0][`failures_${index}`],
    );
    expect(sent[0].api_wallet_network_error).toBe(
      AVAILABILITY_MAX_FAILURE_KEYS + 1,
    );
    expect(Number(sent[0].failuresOmitted)).toBeGreaterThan(1);
    // All eight slots are used before anything is dropped, and none of them
    // exceeds the property length limit.
    expect(texts.map((text) => typeof text)).toEqual(Array(8).fill('string'));
    expect(texts.every((text) => String(text).length <= 255)).toBe(true);
    expect(sent[0]).not.toHaveProperty('failures_9');
  });

  it('packs a failure detail into any slot with room, not only the last', async () => {
    const { aggregator, flush, sent } = createHarness();
    const record = (detail: string) =>
      aggregator.record({
        source: 'api',
        target: 'wallet',
        status: 'network_error',
        failure: { detail, errorCode: 'err_network' },
      });
    // Seven details too long to share a slot, each sorted ahead of the short
    // ones by count, then eight short details that each fit beside a long one.
    // Appending only to the last slot leaves that room unused and drops four.
    for (let index = 0; index < 8; index += 1) {
      for (let repeat = 0; repeat < 8 - index; repeat += 1) {
        record(`sni:/long/${index}/${'x'.repeat(150)}`);
      }
      record(`sni:/short/${index}`);
    }
    await flush();

    const packed = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((index) => String(sent[0][`failures_${index}`] ?? ''))
      .join(',');
    for (let index = 0; index < 8; index += 1) {
      expect(packed).toContain(`sni:/short/${index}|`);
      expect(packed).toContain(`sni:/long/${index}/`);
    }
    expect(sent[0]).not.toHaveProperty('failuresOmitted');
  });

  it('reports counters that did not fit, like it reports failures', async () => {
    const { aggregator, flush, sent } = createHarness();
    for (let index = 0; index < 260; index += 1) {
      aggregator.record({
        source: 'api_endpoint',
        target: `endpoint${index}`,
        status: 'ok',
      });
    }
    await flush();

    expect(
      Object.keys(sent[0]).filter((key) => key.startsWith('api_endpoint')),
    ).toHaveLength(200);
    expect(sent[0].countersOmitted).toBe(60);
  });

  it('sends on the traffic it measures, with no tick and no visibility event', async () => {
    const { aggregator, sent } = createHarness();
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await settle();

    expect(sent).toEqual([expect.objectContaining({ api_wallet_ok: 1 })]);
  });

  it('does not drop a trigger that arrives while a flush is waiting', async () => {
    const { aggregator, deps, sent } = createHarness();
    let release: ((value: boolean) => void) | undefined;
    let canSendCalls = 0;
    deps.canSend = async () => {
      canSendCalls += 1;
      if (canSendCalls > 1) return true;
      return new Promise<boolean>((resolve) => {
        release = resolve;
      });
    };

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await settle();
    expect(sent).toHaveLength(0);

    const trigger = aggregator.flush('hidden');
    release?.(false);
    await trigger;
    await settle();

    expect(sent).toEqual([expect.objectContaining({ api_wallet_ok: 1 })]);
  });

  it('stops re-running a flush that every attempt re-triggers', async () => {
    const { aggregator, deps, sent } = createHarness();
    let canSendCalls = 0;
    deps.canSend = async () => {
      canSendCalls += 1;
      // A trigger arriving during every attempt must not spin the loop. The
      // bound on the re-triggering keeps a regression an assertion, not a hang.
      if (canSendCalls <= 20) void aggregator.flush('tick');
      return false;
    };

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await settle();

    expect(sent).toHaveLength(0);
    expect(canSendCalls).toBe(4);
  });

  it('gives up on a check that never settles instead of going quiet for good', async () => {
    jest.useFakeTimers();
    const { aggregator, deps, sent } = createHarness();
    let canSendCalls = 0;
    deps.canSend = async () => {
      canSendCalls += 1;
      if (canSendCalls > 1) return true;
      return new Promise<boolean>(() => {});
    };

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await jest.advanceTimersByTimeAsync(11_000);
    expect(sent).toHaveLength(0);

    await aggregator.flush('hidden');
    await jest.advanceTimersByTimeAsync(0);

    expect(sent).toEqual([expect.objectContaining({ api_wallet_ok: 1 })]);
  });

  it('writes counters recorded before stored state was read', async () => {
    // Backgrounding during hydration used to leave the window in memory only:
    // persist refused while canWrite was false, and nothing rewrote it.
    let releaseLoad: ((text: string) => void) | undefined;
    const { aggregator, deps, store } = createHarness();
    deps.storage.load = () =>
      new Promise<string>((resolve) => {
        releaseLoad = resolve;
      });

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    // Not awaited: the flush is blocked on the read that is still in flight,
    // which is the state this covers.
    void aggregator.flush('hidden');
    await settle();
    expect(store.text).toBeUndefined();

    // A send that is not yet due, so nothing else would write the window.
    releaseLoad?.(JSON.stringify({ version: 3, lastSendTs: START }));
    await settle();

    expect(JSON.parse(String(store.text)).current.counters).toEqual({
      api_wallet_ok: 1,
    });
  });

  it('does not send when the write that claims the send fails', async () => {
    // The stored send time is the only thing pacing this runtime across a
    // restart, and a resend after one carries a new id the server cannot
    // deduplicate, so an unclaimed send must not go out.
    const { aggregator, clock, deps, flush, sent } = createHarness();
    const results: string[] = [];
    deps.log = (reason, result) => results.push(result);
    deps.storage.save = async () => {
      throw new OneKeyLocalError('disk full');
    };
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await flush();

    expect(sent).toHaveLength(0);
    expect(results).toContain('claimFailed');

    // Still due afterwards, so the window ships once storage recovers.
    deps.storage.save = async () => undefined;
    clock.now += 1;
    await flush();
    expect(sent).toEqual([expect.objectContaining({ api_wallet_ok: 1 })]);
  });

  it('lets only one of two instances claim the same shared send slot', async () => {
    const storage = {};
    // Web Locks scope: one queue per origin, shared by every page.
    let chain: Promise<unknown> = Promise.resolve();
    const withSendLock = (task: () => Promise<void>) => {
      const run = chain.then(task);
      chain = run.catch(() => undefined);
      return run;
    };
    const tabA = createHarness({ persistWindows: false, storage });
    const tabB = createHarness({ persistWindows: false, storage });
    tabA.deps.withSendLock = withSendLock;
    tabB.deps.withSendLock = withSendLock;
    tabA.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    tabB.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });

    await Promise.all([
      tabA.aggregator.flush('hidden'),
      tabB.aggregator.flush('hidden'),
    ]);
    await settle();

    expect(tabA.sent.length + tabB.sent.length).toBe(1);
  });

  it('gives up on stored state that never loads instead of parking the flush', async () => {
    jest.useFakeTimers();
    const { aggregator, deps, sent } = createHarness();
    const flushLog: string[][] = [];
    deps.log = (reason, result) => {
      flushLog.push([reason, result]);
    };
    // A storage read that never settles used to park `ready` for the life of
    // the runtime, holding `flushing` and swallowing every later trigger.
    deps.storage.load = () => new Promise<string>(() => {});

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await jest.advanceTimersByTimeAsync(11_000);

    // Named apart from a hydrate that answered "cannot write", so an exported
    // log says which one happened.
    expect(flushLog).toEqual([['record', 'readyStalled']]);
    expect(sent).toHaveLength(0);
  });

  it('names a stalled send check apart from one that declined', async () => {
    jest.useFakeTimers();
    const { aggregator, deps, sent } = createHarness();
    const flushLog: string[][] = [];
    deps.log = (reason, result) => {
      flushLog.push([reason, result]);
    };
    deps.canSend = () => new Promise<boolean>(() => {});

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await jest.advanceTimersByTimeAsync(11_000);

    expect(flushLog).toEqual([
      ['hydrate', 'fresh'],
      ['record', 'canSendStalled'],
    ]);
    expect(sent).toHaveLength(0);
  });
});

describe('runtime aggregator wiring', () => {
  function loadRuntime(env: Record<string, unknown>) {
    const storage = {
      getItem: jest.fn(async () => undefined),
      setItem: jest.fn(async (_key: string, _text: string) => undefined),
    };
    let runtime: typeof import('./availabilityAggregator') | undefined;
    jest.isolateModules(() => {
      jest.doMock('../platformEnv', () => ({
        __esModule: true,
        ERuntimeRole: { Main: 'main', Background: 'background' },
        default: { isJest: true, ...env },
      }));
      jest.doMock('../storage/appStorage', () => ({
        __esModule: true,
        default: storage,
      }));
      runtime = jest.requireActual('./availabilityAggregator');
    });
    return {
      runtime: runtime as typeof import('./availabilityAggregator'),
      storage,
    };
  }

  const tick = () => new Promise((resolve) => setImmediate(resolve));

  it('stores native background counters when the main runtime relays hidden', async () => {
    const { runtime, storage } = loadRuntime({
      isNative: true,
      runtimeRole: 'background',
    });
    runtime.recordAvailabilityOutcome({
      source: 'api',
      target: 'wallet',
      status: 'ok',
    });
    await tick();
    runtime.flushAvailabilitySnapshotOnHidden();
    await tick();

    const call = storage.setItem.mock.calls.find(
      ([key]) => key === 'onekey_availability_metrics_bg',
    );
    expect(JSON.parse(String(call?.[1])).current.counters).toEqual({
      api_wallet_ok: 1,
    });
  });

  it.each(['isWebEmbed', 'isExtensionOffscreen'])(
    'does not count when %s',
    (flag) => {
      const { runtime, storage } = loadRuntime({
        isNative: true,
        [flag]: true,
      });
      runtime.recordAvailabilityOutcome({
        source: 'api',
        target: 'wallet',
        status: 'ok',
      });
      expect(storage.getItem).not.toHaveBeenCalledWith(
        'onekey_availability_metrics_standalone',
      );
    },
  );
});
