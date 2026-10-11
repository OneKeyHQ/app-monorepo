/* eslint-disable import/first */

const mockSetMap = jest.fn();
jest.mock('../utils', () => ({
  __esModule: true,
  globalAtom: () => ({
    target: { atom: () => ({}), set: jest.fn(async () => undefined) },
    use: () => [{}, mockSetMap],
  }),
}));

jest.mock('jotai', () => ({ useSetAtom: () => mockSetMap }));

import { renderHook } from '@testing-library/react-native';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  EJotaiContextStoreNames,
  JOTAI_CONTEXT_STORE_REGISTRATION_LEASE_MS,
  JotaiContextStoreRegistrationRegistry,
  getJotaiContextTrackerMap,
  useJotaiContextTrackerMap,
  jotaiContextStoreMapAtom,
  updateJotaiContextStoreRegistration,
} from './jotaiContextStoreMap';

import type { IJotaiContextStoreMap } from './jotaiContextStoreMap';

function buildMap(...storeIds: string[]): IJotaiContextStoreMap {
  return Object.fromEntries(
    storeIds.map((storeId) => [
      storeId,
      { storeName: EJotaiContextStoreNames.swap, count: 1 },
    ]),
  );
}

const flushMicrotasks = () => Promise.resolve().then(() => undefined);

// What JotaiContextStoreMirrorTracker does on mount and unmount: it edits the
// live map in place, then hands the hook a shallow copy of it.
function trackerAdd(
  setMap: (map: IJotaiContextStoreMap) => void,
  storeId: string,
) {
  const live = getJotaiContextTrackerMap();
  const value = live[storeId] ?? {
    storeName: EJotaiContextStoreNames.swap,
    count: 0,
  };
  value.count += 1;
  setMap({ ...live, [storeId]: value });
}

function trackerRemove(
  setMap: (map: IJotaiContextStoreMap) => void,
  storeId: string,
) {
  const live = getJotaiContextTrackerMap();
  const value = live[storeId];
  value.count -= 1;
  if (value.count <= 0) {
    delete live[storeId];
    setMap({ ...live });
    return;
  }
  setMap({ ...live, [storeId]: value });
}

describe('jotaiContextStoreMap', () => {
  it('includes the market swap review store name', () => {
    expect(EJotaiContextStoreNames.marketSwapReview).toBe('marketSwapReview');
    expect(EJotaiContextStoreNames.marketSwap).toBe('marketSwap');
  });

  it('merges interleaved extension runtime registrations in background ownership order', () => {
    const registry = new JotaiContextStoreRegistrationRegistry();
    const storeId = 'accountSelector:swap';
    const update = ({
      action = 'add',
      enabledNum,
      registrationId,
      revision,
    }: {
      action?: 'add' | 'remove';
      enabledNum: number[];
      registrationId: string;
      revision: number;
    }) =>
      registry.update({
        action,
        data: {
          storeName: EJotaiContextStoreNames.accountSelector,
          accountSelectorInfo: {
            enabledNum,
            sceneName: EAccountSelectorSceneName.swap,
          },
        },
        registrationId,
        revision,
        storeId,
      });

    update({ enabledNum: [0], registrationId: 'popup:1', revision: 1 });
    const bothRuntimes = update({
      enabledNum: [1],
      registrationId: 'side-panel:1',
      revision: 1,
    });
    expect(bothRuntimes.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1] },
      count: 2,
    });

    const popupChanged = update({
      enabledNum: [0, 2],
      registrationId: 'popup:1',
      revision: 3,
    });
    expect(popupChanged.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1, 2] },
      count: 2,
    });

    const stalePopupCleanup = update({
      action: 'remove',
      enabledNum: [0],
      registrationId: 'popup:1',
      revision: 2,
    });
    expect(stalePopupCleanup.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1, 2] },
      count: 2,
    });

    const popupClosed = update({
      action: 'remove',
      enabledNum: [0, 2],
      registrationId: 'popup:1',
      revision: 4,
    });
    expect(popupClosed.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [1] },
      count: 1,
    });

    const allClosed = update({
      action: 'remove',
      enabledNum: [1],
      registrationId: 'side-panel:1',
      revision: 2,
    });
    expect(allClosed.map[storeId]).toBeUndefined();
    expect(allClosed.registrationCount).toBe(0);
  });

  it('prunes a runtime that vanished without sending remove', () => {
    let now = 0;
    const registry = new JotaiContextStoreRegistrationRegistry({
      leaseMs: 100,
      now: () => now,
    });
    const storeId = 'accountSelector:swap';
    const buildUpdate = ({
      enabledNum,
      registrationId,
      runtimeId,
    }: {
      enabledNum: number[];
      registrationId: string;
      runtimeId: string;
    }) => ({
      action: 'add' as const,
      data: {
        storeName: EJotaiContextStoreNames.accountSelector,
        accountSelectorInfo: {
          enabledNum,
          sceneName: EAccountSelectorSceneName.swap,
        },
      },
      registrationId,
      revision: 1,
      runtimeId,
      storeId,
    });

    registry.update(
      buildUpdate({
        enabledNum: [0],
        registrationId: 'popup:1',
        runtimeId: 'popup',
      }),
    );
    now = 101;
    const afterPopupDeath = registry.update(
      buildUpdate({
        enabledNum: [1],
        registrationId: 'side-panel:1',
        runtimeId: 'side-panel',
      }),
    );

    expect(afterPopupDeath.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [1] },
      count: 1,
    });
  });

  it('rebuilds all live registrations from a runtime snapshot after background restart', () => {
    const storeId = 'accountSelector:swap';
    const update = {
      action: 'reconcile-runtime' as const,
      registrations: [
        {
          data: {
            storeName: EJotaiContextStoreNames.accountSelector,
            accountSelectorInfo: {
              enabledNum: [0, 1],
              sceneName: EAccountSelectorSceneName.swap,
            },
          },
          registrationId: 'side-panel:1',
          storeId,
        },
      ],
      revision: 2,
      runtimeId: 'side-panel',
      storeId,
    };

    const beforeRestart = new JotaiContextStoreRegistrationRegistry();
    expect(beforeRestart.update(update).map[storeId]?.count).toBe(1);

    const afterRestart = new JotaiContextStoreRegistrationRegistry();
    const rebuilt = afterRestart.update(update);
    expect(rebuilt.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1] },
      count: 1,
    });
  });

  it('renews a lease without publishing an unchanged aggregate map', () => {
    let now = 0;
    const registry = new JotaiContextStoreRegistrationRegistry({
      leaseMs: 100,
      now: () => now,
    });
    const storeId = 'accountSelector:swap';
    const buildSnapshot = (revision: number) => ({
      action: 'reconcile-runtime' as const,
      registrations: [
        {
          data: {
            storeName: EJotaiContextStoreNames.accountSelector,
            accountSelectorInfo: {
              enabledNum: [0],
              sceneName: EAccountSelectorSceneName.swap,
            },
          },
          registrationId: 'side-panel:1',
          storeId,
        },
      ],
      revision,
      runtimeId: 'side-panel',
      storeId,
    });

    expect(registry.update(buildSnapshot(1)).mapChanged).toBe(true);
    now = 50;
    expect(registry.update(buildSnapshot(2)).mapChanged).toBe(false);
    now = 120;
    expect(registry.update(buildSnapshot(3)).map[storeId]?.count).toBe(1);
  });

  it('expires a closed runtime revision tombstone after its lease', () => {
    let now = 0;
    const registry = new JotaiContextStoreRegistrationRegistry({
      leaseMs: 100,
      now: () => now,
    });
    const storeId = 'accountSelector:swap';
    const registration = {
      data: {
        storeName: EJotaiContextStoreNames.accountSelector,
        accountSelectorInfo: {
          enabledNum: [0],
          sceneName: EAccountSelectorSceneName.swap,
        },
      },
      registrationId: 'closed-runtime:1',
      storeId,
    };

    registry.update({
      action: 'reconcile-runtime',
      registrations: [registration],
      revision: 1,
      runtimeId: 'closed-runtime',
      storeId,
    });
    now = 10;
    const closed = registry.update({
      action: 'reconcile-runtime',
      registrations: [],
      revision: 2,
      runtimeId: 'closed-runtime',
      storeId,
    });

    expect(closed.map[storeId]).toBeUndefined();
    expect(registry.getNextExpirationDelayMs()).toBe(100);

    now = 111;
    registry.pruneExpiredRegistrations();
    const afterTombstoneExpiry = registry.update({
      action: 'reconcile-runtime',
      registrations: [registration],
      revision: 1,
      runtimeId: 'closed-runtime',
      storeId,
    });

    expect(afterTombstoneExpiry.map[storeId]?.count).toBe(1);
  });

  it('keeps a throttled extension runtime through a 120-second heartbeat gap', () => {
    let now = 0;
    const registry = new JotaiContextStoreRegistrationRegistry({
      now: () => now,
    });
    const storeId = 'accountSelector:swap';
    const buildSnapshot = ({
      enabledNum,
      revision,
      runtimeId,
    }: {
      enabledNum: number[];
      revision: number;
      runtimeId: string;
    }) => ({
      action: 'reconcile-runtime' as const,
      registrations: [
        {
          data: {
            storeName: EJotaiContextStoreNames.accountSelector,
            accountSelectorInfo: {
              enabledNum,
              sceneName: EAccountSelectorSceneName.swap,
            },
          },
          registrationId: `${runtimeId}:1`,
          storeId,
        },
      ],
      revision,
      runtimeId,
      storeId,
    });

    registry.update(
      buildSnapshot({
        enabledNum: [0],
        revision: 1,
        runtimeId: 'expand-tab',
      }),
    );
    registry.update(
      buildSnapshot({
        enabledNum: [1],
        revision: 1,
        runtimeId: 'popup',
      }),
    );

    for (const [elapsed, revision] of [
      [60_001, 2],
      [120_001, 3],
    ] as const) {
      now = elapsed;
      const activeRuntimeUpdate = registry.update(
        buildSnapshot({
          enabledNum: [1],
          revision,
          runtimeId: 'popup',
        }),
      );
      expect(activeRuntimeUpdate.map[storeId]).toMatchObject({
        accountSelectorInfo: { enabledNum: [0, 1] },
        count: 2,
      });
    }

    expect(JOTAI_CONTEXT_STORE_REGISTRATION_LEASE_MS).toBeGreaterThan(now);
    const delayedHeartbeat = registry.update(
      buildSnapshot({
        enabledNum: [0],
        revision: 2,
        runtimeId: 'expand-tab',
      }),
    );
    expect(delayedHeartbeat.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1] },
      count: 2,
    });
  });

  it('expires the sole vanished runtime without waiting for another update', async () => {
    jest.useFakeTimers({ now: 0 });
    jest.spyOn(jotaiContextStoreMapAtom, 'set').mockResolvedValue(undefined);
    try {
      const storeId = 'accountSelector:orphan-expiry';
      const initialPromise = updateJotaiContextStoreRegistration({
        action: 'reconcile-runtime',
        registrations: [
          {
            data: {
              storeName: EJotaiContextStoreNames.accountSelector,
              accountSelectorInfo: {
                enabledNum: [0],
                sceneName: EAccountSelectorSceneName.home,
              },
            },
            registrationId: 'orphan-runtime:1',
            storeId,
          },
        ],
        revision: 1,
        runtimeId: 'orphan-runtime',
        storeId,
      });
      await jest.advanceTimersByTimeAsync(0);
      const initial = await initialPromise;
      expect(initial.map[storeId]?.count).toBe(1);

      await jest.advanceTimersByTimeAsync(
        JOTAI_CONTEXT_STORE_REGISTRATION_LEASE_MS,
      );

      expect(getJotaiContextTrackerMap()[storeId]).toBeUndefined();
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });
});

describe('useJotaiContextTrackerMap', () => {
  beforeEach(() => {
    mockSetMap.mockClear();
  });

  it('exposes every update to same-runtime readers at once', () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('sync-1'));
    expect(getJotaiContextTrackerMap()).toEqual(buildMap('sync-1'));

    result.current.setMap(buildMap('sync-1', 'sync-2'));
    expect(getJotaiContextTrackerMap()).toEqual(buildMap('sync-1', 'sync-2'));
  });

  it('writes the atom once per batch, with the final map', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('batch-1'));
    result.current.setMap(buildMap('batch-1', 'batch-2'));
    result.current.setMap(buildMap('batch-1', 'batch-2', 'batch-3'));
    expect(mockSetMap).not.toHaveBeenCalled();

    await flushMicrotasks();

    expect(mockSetMap).toHaveBeenCalledTimes(1);
    expect(mockSetMap).toHaveBeenCalledWith(
      buildMap('batch-1', 'batch-2', 'batch-3'),
    );
  });

  it('writes nothing when a provider mounts and unmounts within one batch', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('kept'));
    await flushMicrotasks();
    mockSetMap.mockClear();

    result.current.setMap(buildMap('kept', 'transient'));
    result.current.setMap(buildMap('kept'));
    await flushMicrotasks();

    expect(mockSetMap).not.toHaveBeenCalled();
    expect(getJotaiContextTrackerMap()).toEqual(buildMap('kept'));
  });

  it('writes again for the next batch', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('next-1'));
    await flushMicrotasks();
    mockSetMap.mockClear();

    result.current.setMap(buildMap('next-1', 'next-2'));
    await flushMicrotasks();

    expect(mockSetMap).toHaveBeenCalledTimes(1);
    expect(mockSetMap).toHaveBeenCalledWith(buildMap('next-1', 'next-2'));
  });

  it('flushes a batch through a setter that is still mounted', async () => {
    const first = renderHook(() => useJotaiContextTrackerMap());
    const second = renderHook(() => useJotaiContextTrackerMap());

    first.result.current.setMap(buildMap('owner-1'));
    second.result.current.setMap(buildMap('owner-1', 'owner-2'));
    first.unmount();
    await flushMicrotasks();

    expect(mockSetMap).toHaveBeenCalledTimes(1);
    expect(mockSetMap).toHaveBeenCalledWith(buildMap('owner-1', 'owner-2'));

    second.unmount();
  });

  it('writes the removal when the last mirror of a store unmounts', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    trackerAdd(result.current.setMap, 'last-mirror');
    await flushMicrotasks();
    expect(mockSetMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        'last-mirror': expect.objectContaining({ count: 1 }),
      }),
    );
    mockSetMap.mockClear();

    trackerRemove(result.current.setMap, 'last-mirror');
    await flushMicrotasks();

    expect(mockSetMap).toHaveBeenCalledTimes(1);
    expect(mockSetMap.mock.calls[0][0]).not.toHaveProperty('last-mirror');
  });

  it('writes a changed mirror count for a store that stays mounted', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    trackerAdd(result.current.setMap, 'two-mirrors');
    await flushMicrotasks();
    mockSetMap.mockClear();

    trackerAdd(result.current.setMap, 'two-mirrors');
    await flushMicrotasks();
    expect(mockSetMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        'two-mirrors': expect.objectContaining({ count: 2 }),
      }),
    );
    mockSetMap.mockClear();

    trackerRemove(result.current.setMap, 'two-mirrors');
    await flushMicrotasks();
    expect(mockSetMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        'two-mirrors': expect.objectContaining({ count: 1 }),
      }),
    );

    trackerRemove(result.current.setMap, 'two-mirrors');
    await flushMicrotasks();
  });

  it('never hands the atom an object the tracker edits afterwards', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    trackerAdd(result.current.setMap, 'isolated');
    await flushMicrotasks();
    const written = mockSetMap.mock.calls.at(-1)?.[0] as IJotaiContextStoreMap;

    // The tracker edits the live map on the next unmount, before any write.
    const live = getJotaiContextTrackerMap();
    live.isolated.count = 0;
    delete live.isolated;

    expect(written.isolated).toEqual(expect.objectContaining({ count: 1 }));

    result.current.setMap({ ...live });
    await flushMicrotasks();
  });

  it('still writes nothing for a mount and unmount inside one batch', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());
    await flushMicrotasks();
    mockSetMap.mockClear();

    trackerAdd(result.current.setMap, 'same-batch');
    trackerRemove(result.current.setMap, 'same-batch');
    await flushMicrotasks();

    expect(mockSetMap).not.toHaveBeenCalled();
  });
});
