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
    runtimeScope: 'bg',
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
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { aggregator, clock, deps, flush, sent, store };
}

describe('AvailabilityAggregator', () => {
  beforeEach(() => {
    nextId = 0;
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
        schemaVersion: 2,
        snapshotId: 'id-1',
        runtimeScope: 'bg',
        windowStartTs: START,
        windowEndTs: START,
        windowCount: 1,
        api_wallet_ok: 1,
        api_wallet_timeout: 1,
        api_wallet_slow: 1,
        api_net_wifi_failed: 1,
        failures_1: 'api|wallet|timeout|sni:/wallet/v1|econnaborted=1',
      },
    ]);
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
      version: 1,
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
          version: 1,
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

    const texts = [1, 2, 3, 4].map((index) => sent[0][`failures_${index}`]);
    expect(sent[0].api_wallet_network_error).toBe(
      AVAILABILITY_MAX_FAILURE_KEYS + 1,
    );
    expect(Number(sent[0].failuresOmitted)).toBeGreaterThan(1);
    expect(texts.every((text) => String(text).length <= 255)).toBe(true);
    expect(sent[0]).not.toHaveProperty('failures_5');
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
