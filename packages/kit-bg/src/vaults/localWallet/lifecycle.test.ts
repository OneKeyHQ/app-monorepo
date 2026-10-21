import {
  LOCAL_WALLET_LIFECYCLE,
  LOCAL_WALLET_LIFECYCLE_STEPS,
  planLocalWalletLifecycle,
} from './lifecycle';

import type {
  ILocalWalletDataClass,
  ILocalWalletLifecycleEffect,
  ILocalWalletLifecycleEvent,
} from './lifecycle';

// STORAGE-DESIGN.md §3.6, written out independently of lifecycle.ts. Rows
// the design leaves blank ("—") are 'keep'. localHistory is not a design
// column; it records what the existing repair paths already cleared.
const D = 'delete';
const K = 'keep';

const DESIGN: Record<
  ILocalWalletLifecycleEvent,
  Record<ILocalWalletDataClass, ILocalWalletLifecycleEffect>
> = {
  deleteAccount: {
    accountState: D,
    viewingKeys: D,
    zcashTransparentJournal: D,
    xmrSent: D,
    displayCaches: D,
    chainTips: K,
    runtimeRows: 'unlessAlias',
    memoryCaches: D,
    genericStorage: D,
    localHistory: K,
    walletState: K,
    deviceState: K,
  },
  deleteWallet: {
    accountState: D,
    viewingKeys: D,
    zcashTransparentJournal: D,
    xmrSent: D,
    displayCaches: D,
    chainTips: K,
    runtimeRows: 'unlessAlias',
    memoryCaches: D,
    genericStorage: D,
    localHistory: K,
    walletState: D,
    deviceState: K,
  },
  disable: {
    accountState: 'pause',
    viewingKeys: K,
    zcashTransparentJournal: K,
    xmrSent: K,
    displayCaches: K,
    chainTips: K,
    runtimeRows: K,
    memoryCaches: 'progressOnly',
    genericStorage: K,
    localHistory: K,
    walletState: K,
    deviceState: K,
  },
  networkPause: {
    accountState: K,
    viewingKeys: K,
    zcashTransparentJournal: K,
    xmrSent: K,
    displayCaches: K,
    chainTips: K,
    runtimeRows: K,
    memoryCaches: 'pauseFlag',
    genericStorage: K,
    localHistory: K,
    walletState: K,
    deviceState: K,
  },
  deleteLocalData: {
    accountState: 'keepBirthday',
    viewingKeys: D,
    zcashTransparentJournal: 'dropExpired',
    xmrSent: D,
    displayCaches: D,
    chainTips: K,
    runtimeRows: 'unlessAlias',
    memoryCaches: D,
    genericStorage: D,
    localHistory: K,
    walletState: K,
    deviceState: K,
  },
  resetSyncStorage: {
    accountState: K,
    viewingKeys: K,
    zcashTransparentJournal: K,
    xmrSent: K,
    displayCaches: D,
    chainTips: K,
    runtimeRows: 'rebuild',
    memoryCaches: 'restartScan',
    genericStorage: D,
    localHistory: D,
    walletState: K,
    deviceState: K,
  },
  rescan: {
    accountState: K,
    viewingKeys: K,
    zcashTransparentJournal: K,
    xmrSent: K,
    displayCaches: D,
    chainTips: K,
    runtimeRows: 'rewind',
    memoryCaches: 'restartScan',
    genericStorage: K,
    localHistory: D,
    walletState: K,
    deviceState: K,
  },
  clearCache: {
    accountState: K,
    viewingKeys: K,
    zcashTransparentJournal: K,
    xmrSent: K,
    displayCaches: D,
    chainTips: D,
    // The user's rule: clearing cache never touches scan data.
    runtimeRows: K,
    memoryCaches: D,
    genericStorage: K,
    localHistory: K,
    walletState: K,
    deviceState: K,
  },
  clearPending: {
    accountState: K,
    viewingKeys: K,
    zcashTransparentJournal: 'clearPending',
    xmrSent: K,
    displayCaches: K,
    chainTips: K,
    runtimeRows: K,
    memoryCaches: K,
    genericStorage: K,
    localHistory: K,
    walletState: K,
    deviceState: K,
  },
  appReset: {
    accountState: D,
    viewingKeys: D,
    zcashTransparentJournal: D,
    xmrSent: D,
    displayCaches: D,
    chainTips: D,
    runtimeRows: 'dropNetwork',
    memoryCaches: D,
    genericStorage: 'clearedWithAppStorage',
    localHistory: 'clearedWithAppStorage',
    walletState: 'clearedWithAppStorage',
    deviceState: 'rewritePendingDrop',
  },
  travelMode: {
    accountState: K,
    viewingKeys: K,
    zcashTransparentJournal: K,
    xmrSent: K,
    displayCaches: K,
    chainTips: K,
    runtimeRows: K,
    memoryCaches: D,
    genericStorage: K,
    localHistory: K,
    walletState: K,
    deviceState: K,
  },
};

const events = Object.keys(DESIGN) as ILocalWalletLifecycleEvent[];

describe('privacy chain lifecycle table', () => {
  it('covers every event', () => {
    expect(Object.keys(LOCAL_WALLET_LIFECYCLE).toSorted()).toEqual(
      events.toSorted(),
    );
  });

  it.each(events)('%s: every data class gets the designed effect', (event) => {
    expect(LOCAL_WALLET_LIFECYCLE[event].effects).toEqual(DESIGN[event]);
  });

  it.each(events)('%s: actions follow the fixed step order', (event) => {
    const order = planLocalWalletLifecycle(event).map(({ step }) =>
      LOCAL_WALLET_LIFECYCLE_STEPS.indexOf(step),
    );
    expect(order).toEqual(order.toSorted((a, b) => a - b));
  });

  it.each(events)('%s: plans every non-keep effect once', (event) => {
    const planned = planLocalWalletLifecycle(event).flatMap((action) =>
      'dataClass' in action ? [action.dataClass] : [],
    );
    const expected = (
      Object.entries(DESIGN[event]) as [
        ILocalWalletDataClass,
        ILocalWalletLifecycleEffect,
      ][]
    )
      .filter(([, effect]) => effect !== 'keep')
      .map(([dataClass]) => dataClass);
    expect(planned.toSorted()).toEqual(expected.toSorted());
  });

  it('rotates the epoch before scan data is destroyed and never otherwise', () => {
    for (const event of events) {
      const plan = planLocalWalletLifecycle(event);
      const destroys = plan.some(
        (action) =>
          'dataClass' in action &&
          action.dataClass === 'runtimeRows' &&
          action.effect !== 'dropNetwork',
      );
      const rotates = plan.some(({ step }) => step === 'rotateEpoch');
      // App Reset removes the records the epochs live in.
      expect({ event, rotates }).toEqual({ event, rotates: destroys });
    }
  });

  it('rotates again right after the runtime step of every event that rotates', () => {
    for (const event of events) {
      const steps = planLocalWalletLifecycle(event).map(({ step }) => step);
      const rotates = steps.includes('rotateEpoch');
      expect({ event, settles: steps.includes('settleEpoch') }).toEqual({
        event,
        settles: rotates,
      });
      if (rotates) {
        expect(steps.lastIndexOf('runtime')).toBeLessThan(
          steps.indexOf('settleEpoch'),
        );
      }
    }
  });

  it('stops scheduling only where data goes from under a running scan or the app restarts', () => {
    expect(
      events.filter(
        (event) => LOCAL_WALLET_LIFECYCLE[event].stopScheduling !== 'none',
      ),
    ).toEqual(['appReset', 'travelMode']);
  });

  it('runs host records after the runtime: keys stay until nothing needs them to name runtime rows', () => {
    const plan = planLocalWalletLifecycle('deleteAccount');
    const runtimeAt = plan.findIndex(
      (action) => 'dataClass' in action && action.dataClass === 'runtimeRows',
    );
    const keysAt = plan.findIndex(
      (action) => 'dataClass' in action && action.dataClass === 'viewingKeys',
    );
    const stateAt = plan.findIndex(
      (action) => 'dataClass' in action && action.dataClass === 'accountState',
    );
    expect(runtimeAt).toBeGreaterThan(-1);
    expect(stateAt).toBeGreaterThan(runtimeAt);
    expect(keysAt).toBeGreaterThan(stateAt);
  });
});
