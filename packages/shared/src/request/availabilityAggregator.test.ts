import { OneKeyLocalError } from '../errors';

import {
  AVAILABILITY_FAILURE_TEXT_MAX_LENGTH,
  AVAILABILITY_FAILURE_TEXT_PROPS,
  AVAILABILITY_FLUSH_CHECK_INTERVAL_MS,
  AVAILABILITY_MAX_BREAKDOWN_SERIES_PER_WINDOW,
  AVAILABILITY_MAX_GROUPS,
  AVAILABILITY_MAX_METRIC_PROPS,
  AVAILABILITY_MAX_SERIES_PER_WINDOW,
  AVAILABILITY_MAX_SNAPSHOTS_PER_DAY,
  AVAILABILITY_MIN_SEND_GAP_MS,
  AVAILABILITY_STARTUP_FLUSH_DELAY_MS,
  AvailabilityAggregator,
  addAvailabilityOutcome,
  buildAvailabilitySnapshotParams,
  createAvailabilityWindow,
  mergeAvailabilityWindows,
  sanitizeAvailabilityBudgetState,
  sanitizeAvailabilityWindowsState,
  shouldCountAvailabilityInRuntime,
} from './availabilityAggregator';

import type {
  IAvailabilityAggregatorDeps,
  IAvailabilityBudgetState,
  IAvailabilityScheduler,
  IAvailabilitySource,
  IAvailabilityStorage,
  IAvailabilityWindowsState,
} from './availabilityAggregator';
import type { IAvailabilitySnapshotParams } from '../logger/scopes/app/types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const START_TS = Date.UTC(2026, 8, 15, 0, 30, 0);

type IMemoryStorage = IAvailabilityStorage & {
  peekBudget: () => IAvailabilityBudgetState | undefined;
  peekWindows: () => IAvailabilityWindowsState | undefined;
};

function createMemoryStorage(initial?: {
  budget?: unknown;
  windows?: unknown;
}): IMemoryStorage {
  const values = new Map<string, string>();
  if (initial?.budget !== undefined) {
    values.set('budget', JSON.stringify(initial.budget));
  }
  if (initial?.windows !== undefined) {
    values.set('windows', JSON.stringify(initial.windows));
  }
  const read = (key: string): unknown => {
    const value = values.get(key);
    return value === undefined ? undefined : (JSON.parse(value) as unknown);
  };
  return {
    loadBudget: async () => read('budget'),
    saveBudget: async (state) => {
      values.set('budget', JSON.stringify(state));
    },
    loadWindows: async () => read('windows'),
    saveWindows: async (state) => {
      values.set('windows', JSON.stringify(state));
    },
    peekBudget: () => read('budget') as IAvailabilityBudgetState | undefined,
    peekWindows: () => read('windows') as IAvailabilityWindowsState | undefined,
  };
}

function createHarness(overrides?: Partial<IAvailabilityAggregatorDeps>) {
  let now = START_TS;
  let idSeq = 0;
  const sent: IAvailabilitySnapshotParams[] = [];
  const storage = (overrides?.storage ??
    createMemoryStorage()) as IMemoryStorage;
  const deps: IAvailabilityAggregatorDeps = {
    now: () => now,
    createId: () => {
      idSeq += 1;
      return `window-${idSeq}`;
    },
    persistWindows: true,
    canSend: jest.fn(async () => true),
    send: jest.fn(async (params: IAvailabilitySnapshotParams) => {
      sent.push(params);
    }),
    ...overrides,
    storage,
  };
  return {
    aggregator: new AvailabilityAggregator(deps),
    deps,
    sent,
    storage,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function addTimedOutcomes(
  window: ReturnType<typeof createAvailabilityWindow>,
  source: IAvailabilitySource,
  targets: number,
  statuses: Array<'failed' | 'ok' | 'timeout'>,
) {
  for (let t = 0; t < targets; t += 1) {
    for (const status of statuses) {
      addAvailabilityOutcome(window, {
        source,
        target: `${source}_target_${t}`,
        status,
        durationMs: 4000,
        detail: `/route/${t}`,
        errorCode: status === 'ok' ? undefined : `code_${t}`,
      });
    }
  }
}

describe('buildAvailabilitySnapshotParams', () => {
  it('flattens counters, totals, p95 and slow counts', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    for (let i = 0; i < 19; i += 1) {
      addAvailabilityOutcome(window, {
        source: 'api',
        target: 'wallet',
        status: 'ok',
        durationMs: 250,
      });
    }
    addAvailabilityOutcome(window, {
      source: 'api',
      target: 'wallet',
      status: 'network_error',
      durationMs: 4500,
      detail: '/wallet/v1/account',
      errorCode: 'err_network',
    });
    addAvailabilityOutcome(window, {
      source: 'flow',
      target: 'send',
      status: 'started',
    });
    addAvailabilityOutcome(window, {
      source: 'flow',
      target: 'send',
      status: 'submitted',
      durationMs: 1200,
    });

    const params = buildAvailabilitySnapshotParams(window);

    expect(params).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        snapshotId: 'w1',
        windowCount: 1,
        api_wallet_ok: 19,
        api_wallet_network_error: 1,
        api_wallet_n: 20,
        api_wallet_p95_ms: 300,
        api_wallet_slow: 1,
        flow_send_started: 1,
        flow_send_submitted: 1,
        flow_send_n: 1,
        flow_send_p95_ms: 1200,
        failures_1: 'api|wallet|network_error|/wallet/v1/account|err_network=1',
      }),
    );
    expect(params).not.toHaveProperty('flow_send_slow');
  });

  it('keeps failure details only for failures and sanitizes free-form values', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    addAvailabilityOutcome(window, {
      source: 'flow',
      target: 'send',
      status: 'cancelled',
      errorCode: 'passwordpromptdialogcancel',
    });
    addAvailabilityOutcome(window, {
      source: 'api',
      target: 'onekey-api-other',
      status: 'http_error',
      detail: '/wallet?address=0xsecret, token=1',
      errorCode: 'request failed: secret message',
    });

    const params = buildAvailabilitySnapshotParams(window);

    expect(params.failures_1).toBe(
      'api|onekey_api_other|http_error|other|unknown=1',
    );
    expect(JSON.stringify(params)).not.toContain('secret');
    expect(params.flow_send_cancelled).toBe(1);
  });

  it('keeps API context breakdowns out of failure details', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    addAvailabilityOutcome(window, {
      source: 'api',
      target: 'wallet',
      status: 'timeout',
      durationMs: 3500,
      detail: 'sni:/wallet/v1/account',
      errorCode: 'sni_timeout',
    });
    addAvailabilityOutcome(window, {
      source: 'api_route',
      target: 'sni',
      status: 'timeout',
      durationMs: 3500,
    });
    addAvailabilityOutcome(window, {
      source: 'api_net',
      target: 'cellular',
      status: 'failed',
    });
    addAvailabilityOutcome(window, {
      source: 'api_proxy',
      target: 'off',
      status: 'failed',
    });
    addAvailabilityOutcome(window, {
      source: 'api_ip_table',
      target: 'enabled',
      status: 'failed',
    });

    expect(Object.keys(window.failures)).toEqual([
      'api|wallet|timeout|sni:/wallet/v1/account|sni_timeout',
    ]);
    expect(buildAvailabilitySnapshotParams(window)).toEqual(
      expect.objectContaining({
        api_route_sni_timeout: 1,
        api_route_sni_n: 1,
        api_route_sni_slow: 1,
        api_net_cellular_failed: 1,
        api_net_cellular_n: 1,
        api_proxy_off_failed: 1,
        api_ip_table_enabled_failed: 1,
      }),
    );
  });

  it('ranks primary groups ahead of API breakdowns within the budget', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    // Many high-volume breakdown groups and one low-volume flow group.
    for (let i = 0; i < AVAILABILITY_MAX_GROUPS + 5; i += 1) {
      for (let n = 0; n < 50; n += 1) {
        addAvailabilityOutcome(window, {
          source: 'api_net',
          target: `net_${i}`,
          status: 'ok',
        });
      }
    }
    addAvailabilityOutcome(window, {
      source: 'flow',
      target: 'cloud_backup',
      status: 'ok',
      durationMs: 1500,
    });

    const params = buildAvailabilitySnapshotParams(window);

    expect(params.flow_cloud_backup_n).toBe(1);
    expect(params.flow_cloud_backup_ok).toBe(1);
    expect(params.flow_cloud_backup_p95_ms).toBe(1500);
    expect(params.groupsTruncated).toBe(6);
  });

  it('spends the property budget on primary series before any breakdown', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    // Enough primary data to consume most of the budget on its own.
    addTimedOutcomes(window, 'api', 15, ['ok', 'failed', 'timeout']);
    addTimedOutcomes(window, 'sni', 12, ['ok', 'failed']);
    addTimedOutcomes(window, 'webview', 8, ['ok', 'failed']);
    for (let i = 0; i < 20; i += 1) {
      for (let n = 0; n < 500; n += 1) {
        addAvailabilityOutcome(window, {
          source: 'api_net',
          target: `net_${i}`,
          status: 'ok',
        });
      }
    }

    const params = buildAvailabilitySnapshotParams(window);

    for (let t = 0; t < 15; t += 1) {
      expect(params[`api_api_target_${t}_n`]).toBe(3);
      expect(params[`api_api_target_${t}_p95_ms`]).toBe(4000);
      expect(params[`api_api_target_${t}_slow`]).toBe(3);
    }
    // Breakdown series whose total did not fit are dropped, not orphaned.
    for (const key of Object.keys(params)) {
      const match = /^(api_net_net_\d+)_ok$/.exec(key);
      if (match) {
        expect(params).toHaveProperty(`${match[1]}_n`);
      }
    }
    expect(Number(params.breakdownSeriesTruncated)).toBeGreaterThan(0);
    expect(params).not.toHaveProperty('seriesTruncated');
  });

  it('drops breakdown series whose total lost its group slot', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    // Primary groups take all but two group slots while leaving prop budget.
    for (let i = 0; i < AVAILABILITY_MAX_GROUPS - 2; i += 1) {
      addAvailabilityOutcome(window, {
        source: 'flow',
        target: `flow_${i}`,
        status: 'ok',
      });
    }
    for (let i = 0; i < 10; i += 1) {
      for (let n = 0; n <= i; n += 1) {
        addAvailabilityOutcome(window, {
          source: 'api_net',
          target: `net_${i}`,
          status: 'ok',
        });
      }
    }

    const params = buildAvailabilitySnapshotParams(window);
    const breakdownSeriesKeys = Object.keys(params).filter((key) =>
      /^api_net_net_\d+_ok$/.test(key),
    );

    expect(breakdownSeriesKeys.toSorted()).toEqual([
      'api_net_net_8_ok',
      'api_net_net_9_ok',
    ]);
    expect(params.groupsTruncated).toBe(8);
    expect(params.breakdownSeriesTruncated).toBe(
      // net_0..net_7 hold 1+2+...+8 outcomes.
      36,
    );
  });

  it('keeps separate per-window series caps for primary and breakdown sources', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    for (
      let i = 0;
      i < AVAILABILITY_MAX_BREAKDOWN_SERIES_PER_WINDOW + 3;
      i += 1
    ) {
      addAvailabilityOutcome(window, {
        source: 'api_net',
        target: `net_${i}`,
        status: 'ok',
      });
    }
    addAvailabilityOutcome(window, {
      source: 'flow',
      target: 'cloud_backup',
      status: 'failed',
    });

    expect(window.breakdownSeriesOverflow).toBe(3);
    expect(window.seriesOverflow).toBe(0);
    expect(window.series['flow|cloud_backup|failed']?.count).toBe(1);

    const merged = mergeAvailabilityWindows(
      createAvailabilityWindow({ id: 'w2', now: START_TS }),
      window,
    );
    expect(merged.breakdownSeriesOverflow).toBe(3);
    expect(merged.series['flow|cloud_backup|failed']?.count).toBe(1);
  });

  it('bounds series in a window and reports truncation', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    for (let i = 0; i < AVAILABILITY_MAX_SERIES_PER_WINDOW + 5; i += 1) {
      addAvailabilityOutcome(window, {
        source: 'webview',
        target: `service_${i}`,
        status: 'ok',
      });
    }

    expect(Object.keys(window.series)).toHaveLength(
      AVAILABILITY_MAX_SERIES_PER_WINDOW,
    );
    expect(window.seriesOverflow).toBe(5);
    expect(
      Number(buildAvailabilitySnapshotParams(window).seriesTruncated),
    ).toBeGreaterThanOrEqual(5);
  });

  it('keeps properties and failure texts inside analytics limits at full caps', () => {
    const window = createAvailabilityWindow({ id: 'w1', now: START_TS });
    addTimedOutcomes(window, 'api', 20, ['ok', 'failed', 'timeout']);
    addTimedOutcomes(window, 'sni', 20, ['ok', 'failed', 'timeout']);
    addTimedOutcomes(window, 'webview', 20, ['ok', 'failed', 'timeout']);
    addTimedOutcomes(window, 'ws_connect', 20, ['ok', 'failed', 'timeout']);

    const params = buildAvailabilitySnapshotParams(window);
    const metaKeys = new Set([
      'schemaVersion',
      'snapshotId',
      'windowStartTs',
      'windowEndTs',
      'windowCount',
      'seriesTruncated',
      'breakdownSeriesTruncated',
      'groupsTruncated',
      'failuresOmitted',
    ]);
    const failureKeys = Object.keys(params).filter((key) =>
      key.startsWith('failures_'),
    );
    const metricKeys = Object.keys(params).filter(
      (key) => !metaKeys.has(key) && !key.startsWith('failures_'),
    );

    expect(metricKeys.length).toBeLessThanOrEqual(
      AVAILABILITY_MAX_METRIC_PROPS,
    );
    expect(failureKeys.length).toBeLessThanOrEqual(
      AVAILABILITY_FAILURE_TEXT_PROPS,
    );
    for (const key of failureKeys) {
      expect(String(params[key]).length).toBeLessThanOrEqual(
        AVAILABILITY_FAILURE_TEXT_MAX_LENGTH,
      );
    }
    // Analytics adds about 20 device/context properties; stay below 255.
    expect(Object.keys(params).length + 20).toBeLessThan(255);
    expect(Number(params.seriesTruncated)).toBeGreaterThan(0);
    expect(Number(params.failuresOmitted)).toBeGreaterThan(0);
  });
});

describe('AvailabilityAggregator', () => {
  it('paces sends and never exceeds the daily cap for an always-on client', async () => {
    const { aggregator, advance, sent } = createHarness();
    const checks = DAY_MS / TEN_MINUTES_MS;

    for (let i = 0; i < checks; i += 1) {
      aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
      await aggregator.flush('hidden');
      await aggregator.flush('interval');
      advance(TEN_MINUTES_MS);
    }

    expect(sent.length).toBeLessThanOrEqual(AVAILABILITY_MAX_SNAPSHOTS_PER_DAY);
    expect(sent.length).toBeGreaterThanOrEqual(
      AVAILABILITY_MAX_SNAPSHOTS_PER_DAY - 1,
    );
    const ends = sent.map((params) => Number(params.windowEndTs));
    for (let i = 1; i < ends.length; i += 1) {
      expect(ends[i] - ends[i - 1]).toBeGreaterThanOrEqual(
        AVAILABILITY_MIN_SEND_GAP_MS,
      );
    }
    const counted = sent.reduce(
      (sum, params) => sum + Number(params.api_wallet_ok ?? 0),
      0,
    );
    const { current, pending } = aggregator.getStateForTest();
    const kept =
      (current?.series['api|wallet|ok']?.count ?? 0) +
      (pending?.series['api|wallet|ok']?.count ?? 0);
    // Every recorded outcome is either sent or still held for the next send.
    expect(counted + kept).toBe(checks);
  });

  it('keeps unsent data in one pending window while sends fail, paced by the gap', async () => {
    const send = jest.fn(async () => {
      throw new OneKeyLocalError('offline');
    });
    const { aggregator, advance } = createHarness({ send });

    for (let i = 0; i < 10; i += 1) {
      aggregator.record({
        source: 'api',
        target: 'wallet',
        status: 'network_error',
      });
      await aggregator.flush('interval');
      advance(AVAILABILITY_FLUSH_CHECK_INTERVAL_MS);
    }

    const { pending, current, budget } = aggregator.getStateForTest();
    // Ten checks over five hours: attempts only at 0h, 2h and 4h.
    expect(send).toHaveBeenCalledTimes(3);
    expect(budget?.budgetUsed).toBe(3);
    expect(
      (pending?.series['api|wallet|network_error']?.count ?? 0) +
        (current?.series['api|wallet|network_error']?.count ?? 0),
    ).toBe(10);
  });

  it('does not spend budget while analytics cannot send', async () => {
    const canSend = jest.fn(async () => false);
    const { aggregator, deps } = createHarness({ canSend });

    aggregator.record({ source: 'sni', target: 'wallet', status: 'ok' });
    await aggregator.flush('interval');

    expect(deps.send).not.toHaveBeenCalled();
    expect(aggregator.getStateForTest().budget?.budgetUsed).toBe(0);
    expect(aggregator.getStateForTest().current).toBeDefined();
  });

  it('keeps the daily spend across restarts of a persisting runtime', async () => {
    const storage = createMemoryStorage({
      budget: {
        version: 1,
        budgetDay: '2026-09-15',
        budgetUsed: AVAILABILITY_MAX_SNAPSHOTS_PER_DAY,
        lastAttemptTs: START_TS - 3 * HOUR_MS,
      },
    });
    const { aggregator, advance, sent } = createHarness({ storage });

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await aggregator.flush('interval');
    expect(sent).toHaveLength(0);

    advance(DAY_MS);
    await aggregator.flush('interval');
    expect(sent).toHaveLength(1);
    await aggregator.settleForTest();
    expect(storage.peekBudget()).toEqual(
      expect.objectContaining({ budgetDay: '2026-09-16', budgetUsed: 1 }),
    );
  });

  it('never reopens the budget from a future-dated stored day', async () => {
    const storage = createMemoryStorage({
      budget: {
        version: 1,
        budgetDay: '2027-01-01',
        budgetUsed: AVAILABILITY_MAX_SNAPSHOTS_PER_DAY,
        lastAttemptTs: 0,
      },
    });
    const tab = createHarness({ storage, persistWindows: false });

    for (let i = 0; i < 20; i += 1) {
      tab.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
      await tab.aggregator.flush('hidden');
      tab.advance(HOUR_MS);
    }

    expect(tab.sent).toHaveLength(0);
    await tab.aggregator.settleForTest();
    // Rewritten as today, so the record expires instead of blocking for months.
    expect(storage.peekBudget()?.budgetDay).toBe('2026-09-15');

    tab.advance(DAY_MS);
    await tab.aggregator.flush('hidden');
    expect(tab.sent).toHaveLength(1);
  });

  it('shares budget and pacing across multi-instance runtimes', async () => {
    const storage = createMemoryStorage();
    const tabA = createHarness({ storage, persistWindows: false });
    const tabB = createHarness({ storage, persistWindows: false });
    await tabB.aggregator.settleForTest();

    tabA.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await tabA.aggregator.flush('hidden');
    await tabA.aggregator.settleForTest();
    tabB.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await tabB.aggregator.flush('hidden');

    expect(tabA.sent).toHaveLength(1);
    expect(tabB.sent).toHaveLength(0);
    await tabB.aggregator.settleForTest();
    expect(storage.peekBudget()).toEqual({
      version: 1,
      budgetDay: '2026-09-15',
      budgetUsed: 1,
      lastAttemptTs: START_TS,
    });
    expect(storage.peekWindows()).toBeUndefined();
  });

  it('writes nothing before hydration so a cold start cannot reset spend', async () => {
    let openGate: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const base = createMemoryStorage({
      budget: {
        version: 1,
        budgetDay: '2026-09-15',
        budgetUsed: AVAILABILITY_MAX_SNAPSHOTS_PER_DAY,
        lastAttemptTs: START_TS - 3 * HOUR_MS,
      },
    });
    const saveBudget = jest.fn(base.saveBudget);
    const saveWindows = jest.fn(base.saveWindows);
    const storage: IMemoryStorage = {
      ...base,
      saveBudget,
      saveWindows,
      loadBudget: () => gate.then(() => base.loadBudget()),
    };
    const { aggregator, sent } = createHarness({ storage });

    const handle = aggregator.startFlow('send', { trackUnfinished: true });
    const flushing = aggregator.flush('hidden');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saveBudget).not.toHaveBeenCalled();
    expect(saveWindows).not.toHaveBeenCalled();

    openGate?.();
    await flushing;
    handle.finish({ status: 'submitted' });
    await aggregator.settleForTest();

    // An early write of budgetUsed 0 would have reopened the budget here.
    expect(sent).toHaveLength(0);
    expect(storage.peekBudget()).toEqual(
      expect.objectContaining({
        budgetUsed: AVAILABILITY_MAX_SNAPSHOTS_PER_DAY,
        inflight: {},
      }),
    );
  });

  it('counts flow starts and outcomes once', () => {
    const { aggregator, advance } = createHarness();

    const handle = aggregator.startFlow('hw_connect', { detail: 'onekey:ble' });
    advance(2500);
    handle.finish({ status: 'failed', errorCode: '803' });
    handle.finish({ status: 'ok' });

    const { current } = aggregator.getStateForTest();
    expect(current?.series['flow|hw_connect|started']?.count).toBe(1);
    expect(current?.series['flow|hw_connect|failed']?.count).toBe(1);
    expect(current?.series['flow|hw_connect|ok']).toBeUndefined();
    expect(current?.failures['flow|hw_connect|failed|onekey:ble|803']).toBe(1);
  });

  it('reports flows interrupted by process death as unfinished on next launch', async () => {
    const storage = createMemoryStorage();
    const first = createHarness({ storage });
    await first.aggregator.settleForTest();
    first.aggregator.startFlow('send', { trackUnfinished: true });
    first.aggregator.startFlow('send', { trackUnfinished: true });
    first.aggregator
      .startFlow('send', { trackUnfinished: true })
      .finish({ status: 'submitted' });
    // The first hide sends; the second one is inside the send gap and only
    // persists the newer window before the process "dies".
    await first.aggregator.flush('hidden');
    first.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await first.aggregator.flush('hidden');
    await first.aggregator.settleForTest();
    expect(storage.peekBudget()?.inflight).toEqual({ send: 2 });

    const second = createHarness({ storage });
    await second.aggregator.settleForTest();
    const { current, pending } = second.aggregator.getStateForTest();

    expect(current?.series['flow|send|unfinished']?.count).toBe(2);
    expect(pending?.series['api|wallet|ok']?.count).toBe(1);
    expect(storage.peekBudget()?.inflight).toEqual({});
  });

  it('sends pending windows of the previous process after startup', async () => {
    const pendingWindow = createAvailabilityWindow({
      id: 'old',
      now: START_TS - HOUR_MS,
    });
    addAvailabilityOutcome(pendingWindow, {
      source: 'api',
      target: 'wallet',
      status: 'ok',
    });
    const storage = createMemoryStorage({
      budget: {
        version: 1,
        budgetDay: '2026-09-15',
        budgetUsed: 0,
        lastAttemptTs: 0,
      },
      windows: { version: 1, pending: pendingWindow },
    });
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const scheduler: IAvailabilityScheduler = {
      setInterval: jest.fn(
        () => 1 as unknown as ReturnType<typeof setInterval>,
      ),
      setTimeout: jest.fn((fn: () => void, ms: number) => {
        timeouts.push({ fn, ms });
        return 2 as unknown as ReturnType<typeof setTimeout>;
      }),
    };
    const subscribeVisibility = jest.fn(() => () => undefined);
    const { aggregator, sent } = createHarness({
      storage,
      scheduler,
      subscribeVisibility,
    });

    aggregator.record({ source: 'api', target: 'swap', status: 'ok' });
    await aggregator.settleForTest();

    expect(scheduler.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      AVAILABILITY_FLUSH_CHECK_INTERVAL_MS,
    );
    expect(subscribeVisibility).toHaveBeenCalledTimes(1);
    const startup = timeouts.find(
      (timeout) => timeout.ms === AVAILABILITY_STARTUP_FLUSH_DELAY_MS,
    );
    expect(startup).toBeDefined();

    startup?.fn();
    await aggregator.flush('startup');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual(
      expect.objectContaining({ api_wallet_ok: 1, api_swap_ok: 1 }),
    );
  });

  it('ignores corrupted persisted state', async () => {
    const storage = createMemoryStorage({
      budget: { version: 1, budgetDay: 42 },
      windows: { version: 1, pending: 'broken' },
    });
    const { aggregator } = createHarness({ storage });

    expect(() =>
      aggregator.record({ source: 'api', target: 'wallet', status: 'ok' }),
    ).not.toThrow();
    await aggregator.settleForTest();
    expect(aggregator.getStateForTest().budget?.budgetUsed).toBe(0);
    expect(aggregator.getStateForTest().pending).toBeUndefined();
    expect(
      sanitizeAvailabilityBudgetState({
        version: 1,
        budgetDay: '2026-09-15',
        budgetUsed: 1,
        lastAttemptTs: 5,
        inflight: { send: -1, hw_connect: 3 },
      }),
    ).toEqual({
      version: 1,
      budgetDay: '2026-09-15',
      budgetUsed: 1,
      lastAttemptTs: 5,
      inflight: { hw_connect: 3 },
    });
    expect(
      sanitizeAvailabilityWindowsState({ version: 1, current: { id: 'x' } }),
    ).toEqual({ version: 1, current: undefined, pending: undefined });
  });

  it('serializes concurrent flushes', async () => {
    let resolveSend: (() => void) | undefined;
    const send = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const { aggregator } = createHarness({ send });

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    const first = aggregator.flush('interval');
    const second = aggregator.flush('hidden');
    expect(second).toBe(first);
    // oxlint-disable-next-line no-unmodified-loop-condition -- resolveSend is assigned asynchronously by the send mock.
    while (!resolveSend) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    resolveSend();
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not reopen the budget when the clock moves back in a persisting runtime', async () => {
    const { aggregator, advance, sent, storage } = createHarness();
    await aggregator.settleForTest();
    for (let i = 0; i < AVAILABILITY_MAX_SNAPSHOTS_PER_DAY; i += 1) {
      aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
      await aggregator.flush('interval');
      advance(AVAILABILITY_MIN_SEND_GAP_MS);
    }
    const sentBefore = sent.length;
    // Clock set back across UTC midnight by a few hours.
    advance(-(AVAILABILITY_MIN_SEND_GAP_MS + 6 * HOUR_MS));
    for (let i = 0; i < 5; i += 1) {
      aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
      await aggregator.flush('interval');
      advance(10 * 60 * 1000);
    }

    expect(sent).toHaveLength(sentBefore);
    await aggregator.settleForTest();
    expect(storage.peekBudget()?.budgetUsed).toBe(sentBefore);
  });

  it('never overwrites stored state after a failed read and retries on flush', async () => {
    const base = createMemoryStorage({
      budget: {
        version: 1,
        budgetDay: '2026-09-15',
        budgetUsed: AVAILABILITY_MAX_SNAPSHOTS_PER_DAY,
        lastAttemptTs: START_TS - 3 * HOUR_MS,
      },
      windows: {
        version: 1,
        pending: (() => {
          const window = createAvailabilityWindow({
            id: 'unsent',
            now: START_TS - HOUR_MS,
          });
          addAvailabilityOutcome(window, {
            source: 'api',
            target: 'wallet',
            status: 'ok',
          });
          return window;
        })(),
      },
    });
    let failReads = true;
    const saveBudget = jest.fn(base.saveBudget);
    const saveWindows = jest.fn(base.saveWindows);
    const storage: IMemoryStorage = {
      ...base,
      saveBudget,
      saveWindows,
      loadBudget: () =>
        failReads
          ? Promise.reject(new OneKeyLocalError('storage unavailable'))
          : base.loadBudget(),
    };
    const { aggregator, sent } = createHarness({ storage });

    await aggregator.settleForTest();
    expect(aggregator.getStateForTest().storageReadFailed).toBe(true);
    // Hydrated but unread: flows and flushes must not write anything.
    aggregator.startFlow('send', { trackUnfinished: true });
    await aggregator.flush('hidden');
    await aggregator.settleForTest();
    expect(saveBudget).not.toHaveBeenCalled();
    expect(saveWindows).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);

    failReads = false;
    await aggregator.flush('hidden');
    await aggregator.settleForTest();
    const { pending, budget } = aggregator.getStateForTest();
    expect(budget?.budgetUsed).toBe(AVAILABILITY_MAX_SNAPSHOTS_PER_DAY);
    expect(pending?.id).toBe('unsent');
    expect(storage.peekWindows()?.pending?.id).toBe('unsent');
    expect(sent).toHaveLength(0);
  });

  it('commits shared spend under the cross-instance lock', async () => {
    const storage = createMemoryStorage();
    let lockChain: Promise<unknown> = Promise.resolve();
    const withSharedBudgetLock = (task: () => Promise<boolean>) => {
      const run = lockChain.then(task);
      lockChain = run.catch(() => undefined);
      return run;
    };
    const tabs = [0, 1, 2].map(() =>
      createHarness({ storage, persistWindows: false, withSharedBudgetLock }),
    );
    await Promise.all(tabs.map((tab) => tab.aggregator.settleForTest()));

    for (const tab of tabs) {
      tab.aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    }
    await Promise.all(tabs.map((tab) => tab.aggregator.flush('hidden')));

    expect(tabs.reduce((sum, tab) => sum + tab.sent.length, 0)).toBe(1);
    await Promise.all(tabs.map((tab) => tab.aggregator.settleForTest()));
    expect(storage.peekBudget()?.budgetUsed).toBe(1);
  });

  it('resends an attempted window unchanged and keeps newer data separate', async () => {
    let failSend = true;
    const sentPayloads: IAvailabilitySnapshotParams[] = [];
    const send = jest.fn(async (params: IAvailabilitySnapshotParams) => {
      sentPayloads.push(params);
      if (failSend) {
        throw new OneKeyLocalError('ack lost');
      }
    });
    const storage = createMemoryStorage();
    const { aggregator, advance } = createHarness({ send, storage });

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await aggregator.flush('interval');
    aggregator.record({ source: 'api', target: 'swap', status: 'ok' });
    advance(AVAILABILITY_MIN_SEND_GAP_MS);
    failSend = false;
    await aggregator.flush('interval');

    expect(sentPayloads).toHaveLength(2);
    expect(sentPayloads[1]).toEqual(sentPayloads[0]);
    expect(sentPayloads[1]).not.toHaveProperty('api_swap_ok');
    expect(
      aggregator.getStateForTest().current?.series['api|swap|ok']?.count,
    ).toBe(1);

    // A restart keeps an attempted pending window intact as well.
    failSend = true;
    advance(AVAILABILITY_MIN_SEND_GAP_MS);
    await aggregator.flush('interval');
    await aggregator.settleForTest();
    const restarted = createHarness({ storage });
    await restarted.aggregator.settleForTest();
    const state = restarted.aggregator.getStateForTest();
    expect(state.pending?.attempted).toBe(true);
    expect(state.pending?.series['api|swap|ok']?.count).toBe(1);
    expect(state.pending?.series['api|wallet|ok']).toBeUndefined();
  });

  it('stores the flow start before the in-flight count', async () => {
    const { aggregator, storage } = createHarness();
    await aggregator.settleForTest();

    aggregator.startFlow('cloud_backup', { trackUnfinished: true });
    await aggregator.settleForTest();

    expect(storage.peekBudget()?.inflight).toEqual({ cloud_backup: 1 });
    expect(
      storage.peekWindows()?.current?.series['flow|cloud_backup|started']
        ?.count,
    ).toBe(1);
  });

  it('sends through the real interval, visibility and startup triggers', async () => {
    const intervals: Array<() => void> = [];
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    let visibilityListener: ((visible: boolean) => void) | undefined;
    const scheduler: IAvailabilityScheduler = {
      setInterval: jest.fn((fn: () => void) => {
        intervals.push(fn);
        return 1 as unknown as ReturnType<typeof setInterval>;
      }),
      setTimeout: jest.fn((fn: () => void, ms: number) => {
        timeouts.push({ fn, ms });
        return 2 as unknown as ReturnType<typeof setTimeout>;
      }),
    };
    const waitForSends = async (
      sent: IAvailabilitySnapshotParams[],
      count: number,
    ) => {
      for (let i = 0; i < 50 && sent.length < count; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };
    const { aggregator, advance, sent } = createHarness({
      scheduler,
      subscribeVisibility: (listener) => {
        visibilityListener = listener;
        return () => undefined;
      },
    });

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await aggregator.settleForTest();
    visibilityListener?.(true);
    await waitForSends(sent, 1);
    expect(sent).toHaveLength(0);

    visibilityListener?.(false);
    await waitForSends(sent, 1);
    expect(sent).toHaveLength(1);

    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    advance(AVAILABILITY_MIN_SEND_GAP_MS);
    expect(intervals).toHaveLength(1);
    intervals[0]();
    await waitForSends(sent, 2);
    expect(sent).toHaveLength(2);
  });

  it('restarts the send gap when the clock jumps back within the day', async () => {
    const { aggregator, advance, sent } = createHarness();
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    advance(6 * HOUR_MS);
    await aggregator.flush('interval');
    expect(sent).toHaveLength(1);

    advance(-3 * HOUR_MS);
    aggregator.record({ source: 'api', target: 'wallet', status: 'ok' });
    await aggregator.flush('interval');
    advance(AVAILABILITY_MIN_SEND_GAP_MS - 10 * 60 * 1000);
    await aggregator.flush('interval');
    expect(sent).toHaveLength(1);

    advance(10 * 60 * 1000);
    await aggregator.flush('interval');
    expect(sent).toHaveLength(2);
  });
});

describe('shouldCountAvailabilityInRuntime', () => {
  it('skips web embed and the extension offscreen document', () => {
    expect(shouldCountAvailabilityInRuntime({})).toBe(true);
    expect(
      shouldCountAvailabilityInRuntime({ isExtensionOffscreen: false }),
    ).toBe(true);
    expect(shouldCountAvailabilityInRuntime({ isWebEmbed: true })).toBe(false);
    expect(
      shouldCountAvailabilityInRuntime({ isExtensionOffscreen: true }),
    ).toBe(false);
  });
});
