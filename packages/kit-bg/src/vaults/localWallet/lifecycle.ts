// What each lifecycle event does to each kind of privacy-chain data. Pure
// data: ServicePrivacyChain.runLocalWalletLifecycle is the only executor, and
// it runs the steps below in this fixed order. Chains supply only the
// runtime primitives (ILocalWalletCapability).

export type ILocalWalletLifecycleEvent =
  // Removed-account GC, confirmed against the raw account list.
  | 'deleteAccount'
  // A wallet went: its accounts as deleteAccount, plus the wallet's facts.
  | 'deleteWallet'
  | 'disable'
  // Session only: nothing persisted changes.
  | 'networkPause'
  // Account level, on a turned-off account only.
  | 'deleteLocalData'
  // Settings "Reset storage": rebuild the network's scan database.
  | 'resetSyncStorage'
  // Rescan one account (and its aliases) from a birthday.
  | 'rescan'
  // Settings "Clear cache".
  | 'clearCache'
  // "Clear pending transactions", one account.
  | 'clearPending'
  | 'appReset'
  | 'travelMode';

export type ILocalWalletDataClass =
  // privacyChainState account record.
  | 'accountState'
  | 'viewingKeys'
  | 'zcashTransparentJournal'
  | 'xmrSent'
  // Saved balances (private and public).
  | 'displayCaches'
  | 'chainTips'
  // The runtime's own database rows, by viewing key fingerprint.
  | 'runtimeRows'
  // In-memory caches, progress and other session state.
  | 'memoryCaches'
  // Composed balances in localTokens/accountValue.
  | 'genericStorage'
  // Public rows in the shared history cache.
  | 'localHistory'
  | 'walletState'
  // Device settings and the pending App Reset wipes.
  | 'deviceState';

export type ILocalWalletLifecycleEffect =
  | 'keep'
  | 'delete'
  // accountState: intent off with a resume position (the chain's disable).
  | 'pause'
  // accountState: only the birthday stays.
  | 'keepBirthday'
  // zcashTransparentJournal: only what can no longer be mined goes.
  | 'dropExpired'
  // zcashTransparentJournal: every lock and rawTx that can't be mined any
  // more, plus locks no unexpired send holds.
  | 'clearPending'
  // runtimeRows: deleted unless a live alias still holds them.
  | 'unlessAlias'
  // runtimeRows: the network's database rebuilt from the birthdays.
  | 'rebuild'
  // runtimeRows: the account's scanned data dropped and requeued.
  | 'rewind'
  // runtimeRows: the network's whole database deleted.
  | 'dropNetwork'
  // memoryCaches: only the published progress.
  | 'progressOnly'
  // memoryCaches: the network's in-memory pause flag.
  | 'pauseFlag'
  // memoryCaches: dropped, and the account marked for a fresh backfill.
  | 'restartScan'
  // deviceState: rewritten by App Reset after it clears storage.
  | 'rewritePendingDrop'
  // App Reset clears all app storage right after the executor runs; a retry
  // of a failed wipe must not take facts of wallets added since.
  | 'clearedWithAppStorage';

export type ILocalWalletLifecycleSpec = {
  // What runs before anything is touched: nothing, wait out a running scan
  // tick, or stop every timer for good (the app restarts next).
  stopScheduling: 'none' | 'waitForTick' | 'halt';
  // A new epoch before data goes, so caches read for it turn stale.
  rotateEpoch: boolean;
  effects: Record<ILocalWalletDataClass, ILocalWalletLifecycleEffect>;
  notify: boolean;
};

export const LOCAL_WALLET_LIFECYCLE_STEPS = [
  'stopScheduling',
  'rotateEpoch',
  'runtime',
  'hostRecords',
  'genericStorage',
  'memory',
  'notify',
] as const;

export type ILocalWalletLifecycleStep =
  (typeof LOCAL_WALLET_LIFECYCLE_STEPS)[number];

// Host records go in this order: the account record first, so nothing that
// lists accounts finds one whose key or journal is already gone.
const HOST_RECORD_CLASSES: ILocalWalletDataClass[] = [
  'accountState',
  'viewingKeys',
  'zcashTransparentJournal',
  'xmrSent',
  'displayCaches',
  'chainTips',
  'walletState',
  'deviceState',
];

const STEP_CLASSES: Record<
  Exclude<
    ILocalWalletLifecycleStep,
    'stopScheduling' | 'rotateEpoch' | 'notify'
  >,
  ILocalWalletDataClass[]
> = {
  runtime: ['runtimeRows'],
  hostRecords: HOST_RECORD_CLASSES,
  genericStorage: ['genericStorage', 'localHistory'],
  memory: ['memoryCaches'],
};

const KEEP_ALL: Record<ILocalWalletDataClass, ILocalWalletLifecycleEffect> = {
  accountState: 'keep',
  viewingKeys: 'keep',
  zcashTransparentJournal: 'keep',
  xmrSent: 'keep',
  displayCaches: 'keep',
  chainTips: 'keep',
  runtimeRows: 'keep',
  memoryCaches: 'keep',
  genericStorage: 'keep',
  localHistory: 'keep',
  walletState: 'keep',
  deviceState: 'keep',
};

const DELETE_ACCOUNT_EFFECTS: Record<
  ILocalWalletDataClass,
  ILocalWalletLifecycleEffect
> = {
  ...KEEP_ALL,
  accountState: 'delete',
  viewingKeys: 'delete',
  zcashTransparentJournal: 'delete',
  xmrSent: 'delete',
  displayCaches: 'delete',
  runtimeRows: 'unlessAlias',
  memoryCaches: 'delete',
  genericStorage: 'delete',
};

export const LOCAL_WALLET_LIFECYCLE: Record<
  ILocalWalletLifecycleEvent,
  ILocalWalletLifecycleSpec
> = {
  deleteAccount: {
    stopScheduling: 'none',
    rotateEpoch: true,
    effects: DELETE_ACCOUNT_EFFECTS,
    notify: true,
  },
  deleteWallet: {
    stopScheduling: 'none',
    rotateEpoch: true,
    effects: { ...DELETE_ACCOUNT_EFFECTS, walletState: 'delete' },
    notify: true,
  },
  // The chain's disable reports the change itself.
  disable: {
    stopScheduling: 'none',
    rotateEpoch: false,
    effects: {
      ...KEEP_ALL,
      accountState: 'pause',
      memoryCaches: 'progressOnly',
    },
    notify: false,
  },
  networkPause: {
    stopScheduling: 'none',
    rotateEpoch: false,
    effects: { ...KEEP_ALL, memoryCaches: 'pauseFlag' },
    notify: true,
  },
  deleteLocalData: {
    stopScheduling: 'none',
    rotateEpoch: true,
    effects: {
      ...KEEP_ALL,
      accountState: 'keepBirthday',
      viewingKeys: 'delete',
      zcashTransparentJournal: 'dropExpired',
      xmrSent: 'delete',
      displayCaches: 'delete',
      runtimeRows: 'unlessAlias',
      memoryCaches: 'delete',
      genericStorage: 'delete',
    },
    notify: true,
  },
  resetSyncStorage: {
    stopScheduling: 'none',
    rotateEpoch: true,
    effects: {
      ...KEEP_ALL,
      displayCaches: 'delete',
      runtimeRows: 'rebuild',
      memoryCaches: 'restartScan',
      genericStorage: 'delete',
      localHistory: 'delete',
    },
    notify: true,
  },
  rescan: {
    stopScheduling: 'none',
    rotateEpoch: true,
    effects: {
      ...KEEP_ALL,
      displayCaches: 'delete',
      runtimeRows: 'rewind',
      memoryCaches: 'restartScan',
      localHistory: 'delete',
    },
    notify: true,
  },
  // Never the runtime: rescanning from the birthday can take days.
  clearCache: {
    stopScheduling: 'none',
    rotateEpoch: false,
    effects: {
      ...KEEP_ALL,
      displayCaches: 'delete',
      chainTips: 'delete',
      memoryCaches: 'delete',
    },
    notify: true,
  },
  clearPending: {
    stopScheduling: 'none',
    rotateEpoch: false,
    effects: { ...KEEP_ALL, zcashTransparentJournal: 'clearPending' },
    notify: false,
  },
  appReset: {
    stopScheduling: 'waitForTick',
    rotateEpoch: false,
    effects: {
      accountState: 'delete',
      viewingKeys: 'delete',
      zcashTransparentJournal: 'delete',
      xmrSent: 'delete',
      displayCaches: 'delete',
      chainTips: 'delete',
      runtimeRows: 'dropNetwork',
      memoryCaches: 'delete',
      genericStorage: 'clearedWithAppStorage',
      localHistory: 'clearedWithAppStorage',
      walletState: 'clearedWithAppStorage',
      deviceState: 'rewritePendingDrop',
    },
    notify: false,
  },
  // Persisted data stays (reads are masked); the app restarts right after.
  travelMode: {
    stopScheduling: 'halt',
    rotateEpoch: false,
    effects: { ...KEEP_ALL, memoryCaches: 'delete' },
    notify: false,
  },
};

export type ILocalWalletLifecycleAction =
  | { step: 'stopScheduling'; mode: 'waitForTick' | 'halt' }
  | { step: 'rotateEpoch' }
  | {
      step: 'runtime' | 'hostRecords' | 'genericStorage' | 'memory';
      dataClass: ILocalWalletDataClass;
      effect: Exclude<ILocalWalletLifecycleEffect, 'keep'>;
    }
  | { step: 'notify' };

// The event's actions in execution order, with every "keep" left out.
export function planLocalWalletLifecycle(
  event: ILocalWalletLifecycleEvent,
): ILocalWalletLifecycleAction[] {
  const spec = LOCAL_WALLET_LIFECYCLE[event];
  const actions: ILocalWalletLifecycleAction[] = [];
  for (const step of LOCAL_WALLET_LIFECYCLE_STEPS) {
    if (step === 'stopScheduling') {
      if (spec.stopScheduling !== 'none') {
        actions.push({ step, mode: spec.stopScheduling });
      }
    } else if (step === 'rotateEpoch') {
      if (spec.rotateEpoch) actions.push({ step });
    } else if (step === 'notify') {
      if (spec.notify) actions.push({ step });
    } else {
      for (const dataClass of STEP_CLASSES[step]) {
        const effect = spec.effects[dataClass];
        if (effect !== 'keep') {
          actions.push({ step, dataClass, effect });
        }
      }
    }
  }
  return actions;
}
