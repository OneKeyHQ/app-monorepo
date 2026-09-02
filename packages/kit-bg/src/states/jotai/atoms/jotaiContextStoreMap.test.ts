import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  EJotaiContextStoreNames,
  JOTAI_CONTEXT_STORE_REGISTRATION_LEASE_MS,
  JotaiContextStoreRegistrationRegistry,
} from './jotaiContextStoreMap';

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
});
