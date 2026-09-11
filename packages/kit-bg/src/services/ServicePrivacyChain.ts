import { Mutex } from 'async-mutex';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  privacyChainPerfLog,
  privacyChainPerfSpan,
} from '@onekeyhq/shared/src/utils/privacyChainPerfLog';
import {
  PRIVACY_CHAIN_TIP_POLL_MS,
  shouldStartBoost,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import type { IPrivacyChainBoostTrigger } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { privacyChainAtom } from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';
import { getVaultSettings } from '../vaults/settings';

import {
  getPrivacyChainSyncReason,
  pickPrivacyChainSyncCandidate,
} from './PrivacyChainSyncScheduler';
import { isPrivacySyncSchedulingAllowed } from './PrivacyModeState';
import ServiceBase from './ServiceBase';

import type {
  IPrivacyChainRuntimeState,
  IPrivacyChainSyncReason,
} from './PrivacyChainSyncScheduler';
import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type { VaultBaseChainOnly } from '../vaults/base/VaultBase';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountBalance,
  ILocalWalletAccountState,
  ILocalWalletCapability,
  ILocalWalletPoolDescriptor,
  ILocalWalletSendPool,
  ILocalWalletSyncProgress,
} from '../vaults/localWallet/types';

type IPrivacyChainSyncCandidate = {
  networkId: string;
  runtimeStateKey: string;
  accountIds: string[];
  accountSignature: string;
  chainTip: number | null;
  reason: IPrivacyChainSyncReason;
  capability: ILocalWalletCapability;
  orphanAccountIds: string[];
};

function requireLocalWalletCapability(
  vault: VaultBaseChainOnly,
): ILocalWalletCapability {
  const capability = vault.getLocalWalletCapability();
  if (!capability) {
    throw new OneKeyLocalError(
      `privacy-chain: local wallet capability missing for ${vault.networkId}`,
    );
  }
  return capability;
}

function describePrivacyChainError(error: unknown) {
  const structured =
    typeof error === 'object' && error !== null
      ? (error as {
          params?: Record<string, unknown>;
          detail?: unknown;
        })
      : undefined;
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    operation:
      typeof structured?.params?.operation === 'string'
        ? structured.params.operation
        : undefined,
    detail: structured?.detail,
  };
}

// ONE chain-agnostic singleton for every privacy chain with client-scanned
// wallet state. All chain
// logic lives behind one optional vault capability; a network opts in via
// vaultSettings.localWallet. This service only owns the singleton
// mechanics a vault cannot:
//
// 1. background sync scheduler — periodic tick keeps local wallet state fresh
//    and emits RefreshTokenList so balances update without a manual refresh
// 2. removed-account GC — chain meta / wallet-db caches must not outlive
//    their accounts (AccountRemove event + one boot pass)
// 3. the UI door — vaults are not callable from the UI layer
export type ILocalWalletAccountListItem = {
  accountId: string;
  accountName: string;
  walletId: string;
  walletName: string;
  networkId: string;
};

@backgroundClass()
class ServicePrivacyChain extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      void this.gcRemovedAccounts();
      this.scheduleBackgroundSync(0);
    });
    appEventBus.on(EAppEventBusNames.WalletRemove, () => {
      void this.gcRemovedAccounts();
      this.scheduleBackgroundSync(0);
    });
  }

  // Fan an event out to every chain that opted into local-wallet sync. What
  // the event means for a chain's storage is the chain's business -- this
  // service deliberately holds no opinion about what any of them persist.
  async forEachLocalWalletCapability(
    fn: (capability: ILocalWalletCapability) => Promise<void>,
  ): Promise<void> {
    const networkIds = await this.getLocalWalletNetworkIds();
    for (const networkId of networkIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const vault = await vaultFactory.getChainOnlyVault({ networkId });
        // eslint-disable-next-line no-await-in-loop
        await fn(requireLocalWalletCapability(vault));
      } catch (e) {
        console.error('[privacy-chain] per-vault event failed', {
          networkId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  async onWalletCreated({
    walletId,
    isFreshlyGeneratedMnemonic,
    createdAt,
  }: {
    walletId: string;
    isFreshlyGeneratedMnemonic: boolean;
    createdAt: number;
  }): Promise<void> {
    await this.forEachLocalWalletCapability((capability) =>
      capability.onWalletCreated({
        walletId,
        isFreshlyGeneratedMnemonic,
        createdAt,
      }),
    );
  }

  async assertCanRemoveAccounts({
    accountIds,
  }: {
    accountIds: string[];
  }): Promise<void> {
    if (accountIds.length === 0) {
      return;
    }
    for (const networkId of await this.getLocalWalletNetworkIds()) {
      // eslint-disable-next-line no-await-in-loop
      const vault = await vaultFactory.getChainOnlyVault({ networkId });
      const assertCanRemoveAccount =
        requireLocalWalletCapability(vault).assertCanRemoveAccount;
      if (!assertCanRemoveAccount) {
        // eslint-disable-next-line no-continue
        continue;
      }
      for (const accountId of accountIds) {
        // eslint-disable-next-line no-await-in-loop
        await assertCanRemoveAccount({ accountId });
      }
    }
  }

  initialized = false;

  initPromise: Promise<void> | undefined;

  // ---- startup quiet window ----
  //
  // App startup is already the busiest moment of the process; the scan can
  // afford to stay out of its way. No sync tick fires before `earliestTickAt`:
  // 60s after service construction on its own, shortened to a 30s floor when
  // the user lands on this chain and is explicitly waiting. Reads (balance,
  // progress) are not ticks and are never held back by this.
  serviceBootAt = Date.now();

  earliestTickAt =
    this.serviceBootAt + timerUtils.getTimeDurationMs({ seconds: 60 });

  syncTimer: ReturnType<typeof setTimeout> | undefined;

  periodicSyncTimer: ReturnType<typeof setInterval> | undefined;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (!this.initPromise) {
      this.initPromise = (async () => {
        // Primed here so the tick's gate-two check can stay synchronous.
        await this.isPrivacySyncOnCellularAllowed();
        await this.forEachLocalWalletCapability((capability) =>
          capability.resumePendingOperations(),
        );
        await this.gcRemovedAccounts();
        // Delay comes from the quiet-window clamp, not from this call site.
        console.log('[privacy-chain:sched] startup quiet until', {
          inMs: Math.max(0, this.earliestTickAt - Date.now()),
        });
        this.scheduleBackgroundSync(0);
        // Rate and reasoning live in privacyChainSyncPolicy; this only runs it.
        this.periodicSyncTimer = setInterval(() => {
          this.scheduleBackgroundSync(0);
        }, PRIVACY_CHAIN_TIP_POLL_MS);
        this.initialized = true;
      })();
    }
    try {
      await this.initPromise;
    } finally {
      this.initPromise = undefined;
    }
  }

  syncTimerDueAt = 0;

  scheduleBackgroundSync(delayMs: number) {
    // A tick that lands while "erase all data" runs would re-create the
    // runtime database it just deleted. setTimeout is not covered by
    // resetUtils' setInterval switch, so gate it here.
    if (this.syncTimer || resetUtils.getIsResetting()) {
      return;
    }
    // Clamped to the startup quiet window; inert once the window has passed.
    const effectiveDelayMs = Math.max(
      delayMs,
      this.earliestTickAt - Date.now(),
    );
    this.syncTimerDueAt = Date.now() + effectiveDelayMs;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = undefined;
      void this.backgroundSyncTick();
    }, effectiveDelayMs);
  }

  // ---- foreground boost ----
  //
  // Two paces, one scheduler. The background pace (5s/30s between backfill
  // passes) keeps a long catch-up from disturbing normal app use.
  //
  // The foreground pace is a SESSION, not a pulse: the Sync button asks for
  // it explicitly, and it runs until that backfill finishes, the user leaves
  // the page, or the user dismisses it. Reading progress deliberately does
  // not start one -- looking at a balance is not a request to spend battery.
  foregroundBoostRequestedByNetwork: Record<string, boolean> = {};

  // Networks the user explicitly paused from the always-on light.
  //
  // In memory on purpose, like the boost itself: a boost is a session bound to
  // someone being present, so "I don't want this right now" is scoped the same
  // way. Surviving a restart would leave a user who paused once wondering, a
  // week later, why the chain never catches up -- with the control that would
  // explain it (the light) hidden, because nothing is boosting.
  boostPausedByNetwork: Record<string, boolean> = {};

  // Blocks left in this account's backfill, from what the scheduler last
  // published. Read off the atom on purpose: the wallet's own lane is the one
  // the scan is using, and queueing a read behind a pass to decide whether to
  // speed the pass up would be self-defeating. No published position yet
  // simply means "not known", and the caller re-asks on the next publish.
  async getPublishedRemainingBlocks({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string | undefined;
  }): Promise<number | null> {
    if (!accountId) {
      return null;
    }
    const published = (await privacyChainAtom.get()).progress[
      `${networkId}:${accountId}`
    ];
    if (!published || published.isBackfillComplete) {
      return null;
    }
    const { backfillScannedHeight, backfillTargetHeight } = published;
    if (
      typeof backfillScannedHeight !== 'number' ||
      typeof backfillTargetHeight !== 'number'
    ) {
      return null;
    }
    return Math.max(0, backfillTargetHeight - backfillScannedHeight);
  }

  @backgroundMethod()
  async startForegroundBoost({
    networkId,
    accountId,
    trigger,
  }: {
    networkId: string;
    // Only needed by automatic triggers, which are size-gated. A manual press
    // is honoured without it.
    accountId?: string;
    trigger: IPrivacyChainBoostTrigger;
  }): Promise<void> {
    // What a trigger means is decided in privacyChainSyncPolicy, never here.
    // This resolves the one FACT that policy needs and cannot see for itself.
    const remainingBlocks = await this.getPublishedRemainingBlocks({
      networkId,
      accountId,
    });
    const localWalletNetworkIds = await this.getLocalWalletNetworkIds();
    if (!localWalletNetworkIds.includes(networkId)) {
      return;
    }
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const capability = requireLocalWalletCapability(vault);
    if (
      !shouldStartBoost({
        trigger,
        networkId,
        remainingBlocks,
        pausedByUser: this.boostPausedByNetwork[networkId],
        minRemainingBlocks: capability.syncPolicy.autoBoostMinRemainingBlocks,
      })
    ) {
      return;
    }
    // Reached only by an explicit press, which IS the resume.
    delete this.boostPausedByNetwork[networkId];
    // The shared UI control is capability-based, so verify the selected
    // network before asking its vault to sync.
    const wasRequested = this.foregroundBoostRequestedByNetwork[networkId];
    this.foregroundBoostRequestedByNetwork[networkId] = true;
    if (!wasRequested) {
      console.log('[privacy-chain:sched] foreground pace ON', {
        networkId,
        trigger,
      });
    }
    // Publish before gate two can return early: a boost that is wanted but
    // refused still needs the UI to know, so it can offer the data toggle.
    await this.publishBoostingNetworks();
    if (
      this.deviceIsCellular !== false &&
      !(await this.isPrivacySyncOnCellularAllowed())
    ) {
      // Requested but refused by gate two. The request stands so the banner
      // can offer the toggle; the background pace keeps running meanwhile.
      return;
    }
    await this.init();
    // A waiting user shortens the startup quiet window to its 30s floor --
    // still out of startup's way, but not the full background-pace wait.
    this.earliestTickAt = Math.min(
      this.earliestTickAt,
      this.serviceBootAt + timerUtils.getTimeDurationMs({ seconds: 30 }),
    );
    // Do not let the person waiting sit out a timer aimed further than the
    // quiet window requires, but leave a pass already due soon enough alone --
    // repeated requests must not stampede the scheduler.
    const wantAt = Math.max(Date.now(), this.earliestTickAt);
    if (this.syncTimer && this.syncTimerDueAt > wantAt + 1000) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
    }
    this.scheduleBackgroundSync(0);
  }

  @backgroundMethod()
  async stopForegroundBoost({
    networkId,
  }: {
    networkId: string;
  }): Promise<void> {
    if (!this.foregroundBoostRequestedByNetwork[networkId]) {
      return;
    }
    delete this.foregroundBoostRequestedByNetwork[networkId];
    console.log('[privacy-chain:sched] foreground pace OFF', { networkId });
    await this.publishBoostingNetworks();
  }

  // The light's pause button. Distinct from stopForegroundBoost, which is
  // lifecycle ("this page went away"): pausing is a STATEMENT, and it has to
  // outlast the surfaces that would otherwise re-request a boost the moment
  // they notice none is running. Only pressing Sync clears it.
  //
  // Stops the extra power, not the sync: the background pace keeps the chain
  // moving, which is why nothing here touches the scheduler.
  @backgroundMethod()
  async pauseForegroundBoost({
    networkId,
  }: {
    networkId: string;
  }): Promise<void> {
    this.boostPausedByNetwork[networkId] = true;
    delete this.foregroundBoostRequestedByNetwork[networkId];
    console.log('[privacy-chain:sched] foreground pace PAUSED by user', {
      networkId,
    });
    await this.publishBoostingNetworks();
  }

  // Gate two: the device's own state decides whether a wanted boost may
  // actually run. Only mobile can be metered, and only the UI can see it, so
  // the UI reports it here instead of every touch site threading it through.
  // Native starts unknown and therefore fail-closed for foreground boost until
  // main reports NetInfo across the split-runtime boundary. Other targets do
  // not have a metered mobile transport and start as non-cellular.
  deviceIsCellular: boolean | undefined = platformEnv.isNative
    ? undefined
    : false;

  allowPrivacySyncOnCellularCache: boolean | undefined;

  // Touches arrive on a poll, so this must not hit the db every time.
  async isPrivacySyncOnCellularAllowed(): Promise<boolean> {
    if (this.allowPrivacySyncOnCellularCache === undefined) {
      this.allowPrivacySyncOnCellularCache =
        await this.backgroundApi.simpleDb.privacyChain.getAllowCellularSync();
    }
    return this.allowPrivacySyncOnCellularCache;
  }

  @backgroundMethod()
  async setDeviceNetworkState({
    isCellular,
  }: {
    isCellular: boolean | undefined;
  }): Promise<void> {
    this.deviceIsCellular = isCellular;
    await this.publishBoostingNetworks();
    if (isCellular === false) {
      this.scheduleBackgroundSync(0);
    }
  }

  @backgroundMethod()
  async setAllowPrivacySyncOnCellular({
    allow,
  }: {
    allow: boolean;
  }): Promise<void> {
    this.allowPrivacySyncOnCellularCache = allow;
    await this.backgroundApi.simpleDb.privacyChain.saveAllowCellularSync({
      allow,
    });
    await this.publishBoostingNetworks();
    if (allow) {
      this.scheduleBackgroundSync(0);
    }
  }

  @backgroundMethod()
  async getAllowPrivacySyncOnCellular(): Promise<boolean> {
    return this.isPrivacySyncOnCellularAllowed();
  }

  @backgroundMethod()
  async setAllowCellularSync({ allow }: { allow: boolean }): Promise<void> {
    await this.setAllowPrivacySyncOnCellular({ allow });
  }

  @backgroundMethod()
  async getForegroundSyncState({ networkId }: { networkId: string }): Promise<{
    isHot: boolean;
    isBlockedByData: boolean;
    isCellular: boolean;
    allowCellularSync: boolean;
  }> {
    return {
      isHot: this.isNetworkForegroundHot(networkId),
      isBlockedByData: this.isNetworkBoostBlockedByData(networkId),
      isCellular: this.deviceIsCellular === true,
      allowCellularSync: await this.isPrivacySyncOnCellularAllowed(),
    };
  }

  // Requested, but gate two says the device cannot afford it right now. This
  // is what the banner reads to offer the metered-data toggle.
  isNetworkBoostBlockedByData(networkId: string): boolean {
    return (
      !!this.foregroundBoostRequestedByNetwork[networkId] &&
      this.deviceIsCellular !== false &&
      this.allowPrivacySyncOnCellularCache !== true
    );
  }

  // Read synchronously by the scheduler tick, so gate two is answered from
  // the primed cache rather than the db (see init).
  isNetworkForegroundHot(networkId: string): boolean {
    if (!this.foregroundBoostRequestedByNetwork[networkId]) {
      return false;
    }
    return !this.isNetworkBoostBlockedByData(networkId);
  }

  @backgroundMethod()
  async wakeLocalWalletSync(): Promise<void> {
    await this.init();
    this.scheduleBackgroundSync(0);
  }

  async onLocalWalletAccountsChanged({
    networkId,
    accountIds,
    backfillActive,
  }: {
    networkId: string;
    accountIds: string[];
    backfillActive: boolean;
  }): Promise<void> {
    for (const accountId of accountIds) {
      if (backfillActive) {
        this.backfillActiveByAccount[accountId] = true;
      } else {
        delete this.backfillActiveByAccount[accountId];
      }
    }
    if (!backfillActive) {
      await privacyChainAtom.set((value) => {
        const progress = { ...value.progress };
        for (const accountId of accountIds) {
          delete progress[`${networkId}:${accountId}`];
        }
        return { ...value, progress };
      });
    }
    await this.init();
    this.scheduleBackgroundSync(0);
    appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
    appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
  }

  // App reset: wipe every client-side scan database. Runs before the app
  // storage is cleared, while vault settings can still be resolved.
  @backgroundMethod()
  async dropAllLocalWalletData(): Promise<void> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
    }
    const networkIds = await this.getLocalWalletNetworkIds();
    for (const networkId of networkIds) {
      try {
        const vault = await vaultFactory.getChainOnlyVault({ networkId });
        await vault.getLocalWalletCapability()?.dropLocalData?.();
      } catch (e) {
        console.error('[privacy-chain] drop local data failed', {
          networkId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  localWalletNetworkIdsCache: string[] | undefined;

  localWalletNetworkIdsCacheAt = 0;

  @backgroundMethod()
  async getLocalWalletNetworkIds(): Promise<string[]> {
    if (
      !this.localWalletNetworkIdsCache ||
      Date.now() - this.localWalletNetworkIdsCacheAt >
        timerUtils.getTimeDurationMs({ minute: 1 })
    ) {
      const { networks } =
        await this.backgroundApi.serviceNetwork.getAllNetworks();
      const ids: string[] = [];
      for (const network of networks) {
        try {
          const settings = await getVaultSettings({ networkId: network.id });
          if (settings.localWallet) {
            ids.push(network.id);
          }
        } catch {
          // network without vault settings — not a candidate
        }
      }
      this.localWalletNetworkIdsCache = ids;
      this.localWalletNetworkIdsCacheAt = Date.now();
    }
    return this.localWalletNetworkIdsCache;
  }

  // ---- background sync scheduler ----

  syncTickRunning = false;

  // accounts whose last bounded sync pass left historic backfill queued;
  // refreshed every tick, read by the rescan door below to cap concurrent
  // deep rescans
  backfillActiveByAccount: Record<string, boolean> = {};

  runtimeSyncState = new Map<string, IPrivacyChainRuntimeState>();

  // A Promise.race timeout does not cancel the losing sync. Keep that runtime
  // quarantined until its writer finishes or its carrier confirms replacement; otherwise a
  // second lease can write the same wallet database concurrently with the
  // abandoned first operation.
  quarantinedSyncs = new Map<string, Promise<unknown>>();

  lastBackfillRuntimeStateKey: string | undefined;

  // A tick requested while one is running (account/network/cellular change)
  // must not wait for the next 5-minute poll.
  syncTickRequested = false;

  async backgroundSyncTick() {
    if (resetUtils.getIsResetting()) {
      return;
    }
    if (this.syncTickRunning) {
      this.syncTickRequested = true;
      return;
    }
    this.syncTickRunning = true;
    const tickStartedAt = Date.now();
    let continueDelayMs: number | undefined;
    try {
      if (
        !isPrivacySyncSchedulingAllowed({
          deviceIsCellular: this.deviceIsCellular,
          allowPrivacySyncOnCellular:
            await this.isPrivacySyncOnCellularAllowed(),
        })
      ) {
        return;
      }
      let anyStateChanged = false;
      let retryNeeded = false;
      const seenAccountIds = new Set<string>();
      const seenRuntimeStateKeys = new Set<string>();
      const prunableNetworkIds = new Set<string>();
      const liveNetworkIds = new Set<string>();
      const candidates: IPrivacyChainSyncCandidate[] = [];
      for (const networkId of await this.getLocalWalletNetworkIds()) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const vault = await vaultFactory.getChainOnlyVault({ networkId });
          const capability = requireLocalWalletCapability(vault);
          // eslint-disable-next-line no-await-in-loop
          const { accounts: storedAccounts } = await capability.listAccounts();
          const accounts = storedAccounts.filter(
            ({ syncEnabled }) => syncEnabled,
          );
          if (accounts.length === 0) {
            prunableNetworkIds.add(networkId);
            // eslint-disable-next-line no-continue
            continue;
          }
          const groups = new Map<string, string[]>();
          const orphanAccountIds = new Set<string>();
          for (const { accountId, runtimeKey } of accounts) {
            // eslint-disable-next-line no-await-in-loop
            const dbAccount =
              await this.backgroundApi.serviceAccount.getDBAccountSafe({
                accountId,
              });
            if (!dbAccount) {
              // Keep unresolved orphan transactions advancing until the
              // runtime allows the normal GC purge to complete.
              orphanAccountIds.add(accountId);
            } else {
              seenAccountIds.add(accountId);
            }
            liveNetworkIds.add(networkId);
            const group = groups.get(runtimeKey) ?? [];
            group.push(accountId);
            groups.set(runtimeKey, group);
          }
          // Liveness is now fully known for this network, so only this point
          // authorizes destructive pruning of its old UI state. A later tip
          // failure must preserve the accounts and foreground boost.
          prunableNetworkIds.add(networkId);
          // One cheap head request per network. A full WebWallet sync is only
          // queued when this value advances or birthday work remains.
          // eslint-disable-next-line no-await-in-loop
          const chainTip = await capability.getChainTip();
          for (const [runtimeKey, rawAccountIds] of groups) {
            const groupedAccountIds = rawAccountIds.toSorted();
            const runtimeStateKey = `${networkId}|${runtimeKey}`;
            const accountSignature = groupedAccountIds.join('|');
            seenRuntimeStateKeys.add(runtimeStateKey);
            const previous = this.runtimeSyncState.get(runtimeStateKey);
            const hasBackfill = groupedAccountIds.some(
              (accountId) => this.backfillActiveByAccount[accountId],
            );
            const groupHasOrphan = groupedAccountIds.some((accountId) =>
              orphanAccountIds.has(accountId),
            );
            const reason = groupHasOrphan
              ? 'tip'
              : getPrivacyChainSyncReason({
                  previous,
                  accountSignature,
                  chainTip,
                  hasBackfill,
                });
            if (reason) {
              candidates.push({
                networkId,
                runtimeStateKey,
                accountIds: groupedAccountIds,
                accountSignature,
                chainTip,
                reason,
                capability,
                orphanAccountIds: groupedAccountIds.filter((accountId) =>
                  orphanAccountIds.has(accountId),
                ),
              });
            }
          }
        } catch (e) {
          retryNeeded = true;
          console.error('[privacy-chain] network enumeration failed', {
            networkId,
            ...describePrivacyChainError(e),
          });
        }
      }

      const runnableCandidates = candidates.filter(
        ({ runtimeStateKey }) => !this.quarantinedSyncs.has(runtimeStateKey),
      );
      const candidate = pickPrivacyChainSyncCandidate(
        runnableCandidates,
        this.lastBackfillRuntimeStateKey,
      );
      if (candidates.length > 0) {
        // One line per tick: who wanted a turn and who got it. `tip` outranks
        // `backfill`, so another network's new block preempting a backfill --
        // and the db switch that costs -- is visible here, not guessed at.
        console.log('[privacy-chain:sched] pick', {
          picked: candidate
            ? `${candidate.runtimeStateKey}:${candidate.reason}`
            : null,
          candidates: candidates.map((c) => `${c.runtimeStateKey}:${c.reason}`),
        });
      }
      if (candidate) {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let syncPromise: ReturnType<
          ILocalWalletCapability['syncGroup']
        > | null = null;
        try {
          // One bounded group turn: journal replay + registration + sync all
          // live inside syncLocalWalletGroup. A newly-added viewing key
          // requeues only ranges already completed without it; pending
          // birthday/TIP ranges are reused.
          syncPromise = privacyChainPerfSpan(
            'bg sync group',
            () =>
              candidate.capability.syncGroup({
                accountIds: candidate.accountIds,
                chainTip: candidate.chainTip,
              }),
            (res) => ({
              runtime: candidate.runtimeStateKey,
              reason: candidate.reason,
              accounts: candidate.accountIds.length,
              synced: res.synced,
              backfillRemaining: res.backfillRemaining ?? false,
            }),
          );
          const result = await Promise.race([
            syncPromise,
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(
                () =>
                  reject(
                    new OneKeyLocalError(
                      'privacy-chain: wallet-runtime sync timed out',
                    ),
                  ),
                candidate.capability.syncPolicy.maxSyncDurationMs,
              );
            }),
          ]);
          anyStateChanged = !!result.stateChanged;
          if (result.synced) {
            this.runtimeSyncState.set(candidate.runtimeStateKey, {
              accountSignature: candidate.accountSignature,
              lastChainTip:
                result.chainTip ??
                candidate.chainTip ??
                this.runtimeSyncState.get(candidate.runtimeStateKey)
                  ?.lastChainTip ??
                null,
            });
          } else {
            retryNeeded = true;
          }
          for (const accountId of candidate.accountIds) {
            this.backfillActiveByAccount[accountId] =
              !!result.backfillRemaining;
          }
          // Publish while the wallet is still ours. Every reader used to poll
          // for this, and each poll queued behind a pass; reading it once here
          // costs nothing extra and turns readers into subscribers.
          await this.publishScanProgress(candidate);
          // Derive the pace from what the pass just published, rather than
          // waiting for a page to ask. This is what makes a boost a property
          // of how far behind the wallet is instead of which screen is open.
          await this.refreshAutoBoost(candidate);
          if (result.synced && candidate.orphanAccountIds.length > 0) {
            for (const orphanAccountId of candidate.orphanAccountIds) {
              try {
                // eslint-disable-next-line no-await-in-loop
                await candidate.capability.reset({
                  accountId: orphanAccountId,
                  scope: 'all',
                });
              } catch (cleanupError) {
                // The transaction is still unresolved. Keep syncing the
                // runtime-owned account and retry cleanup on a later pass.
                retryNeeded = true;
                console.error('[privacy-chain] orphan settlement pending', {
                  networkId: candidate.networkId,
                  accountId: orphanAccountId,
                  ...describePrivacyChainError(cleanupError),
                });
              }
            }
          }
          if (candidate.reason === 'backfill') {
            this.lastBackfillRuntimeStateKey = candidate.runtimeStateKey;
          }
          if (result.backfillRemaining) {
            const isHot = this.isNetworkForegroundHot(candidate.networkId);
            // Backfill runs hard, tip-following stays gentle (the no-backfill
            // case has no continue delay at all -- it waits for the tip poll).
            if (isHot) {
              continueDelayMs =
                candidate.capability.syncPolicy.foregroundBackfillDelayMs;
            } else if (platformEnv.isDesktop) {
              continueDelayMs =
                candidate.capability.syncPolicy.backgroundBackfillDelayMs
                  .desktop;
            } else {
              continueDelayMs =
                candidate.capability.syncPolicy.backgroundBackfillDelayMs
                  .default;
            }
            console.log('[privacy-chain:sched] next pass', {
              networkId: candidate.networkId,
              pace: isHot ? 'foreground' : 'background',
              delayMs: continueDelayMs,
              blockedByData: this.isNetworkBoostBlockedByData(
                candidate.networkId,
              ),
            });
          }
          console.log('[privacy-chain] bounded sync completed', {
            networkId: candidate.networkId,
            accountIds: candidate.accountIds,
            reason: candidate.reason,
            ...result,
          });
        } catch (e) {
          retryNeeded = true;
          // The watchdog only abandons the await; it does not cancel the
          // operation. Quarantine the exact losing promise below. Native can
          // additionally hard-remount its WebView; in-thread carriers must not
          // swap leases and start a concurrent writer.
          if (
            e instanceof Error &&
            (e.message.includes('wallet-runtime sync timed out') ||
              e.message.includes('WebEmbed bridge call timeout'))
          ) {
            const stuckSync = syncPromise;
            if (!stuckSync) {
              throw e;
            }
            this.quarantinedSyncs.set(candidate.runtimeStateKey, stuckSync);
            const clearQuarantine = () => {
              if (
                this.quarantinedSyncs.get(candidate.runtimeStateKey) ===
                stuckSync
              ) {
                this.quarantinedSyncs.delete(candidate.runtimeStateKey);
                this.scheduleBackgroundSync(0);
              }
            };
            if (candidate.capability.syncCompletionIsAuthoritative) {
              // Direct execution and desktop Worker replies settle only once
              // the writer has finished. A proxy timeout cannot prove that.
              void stuckSync.then(clearQuarantine, clearQuarantine);
            }
            void candidate.capability
              .recoverFromTimeout()
              .then((terminated) => {
                if (terminated) {
                  clearQuarantine();
                }
              })
              .catch((resetErr) => {
                // Keep the group quarantined. A proxy timeout only abandons the
                // caller's Promise and cannot prove the remote writer stopped.
                console.error(
                  '[privacy-chain] carrier timeout recovery failed',
                  resetErr,
                );
              });
          }
          // Log the runtime's structured fields alongside the raw error: its
          // `message` is only an opaque code (e.g. "NETWORK_ERROR"), while
          // `params.operation` names the failing call and `detail` carries
          // the upstream text (including the offending block height). With a
          // shared runtime, one bad account fails the whole group's
          // registration, so naming the height is what identifies which
          // account is at fault.
          console.error('[privacy-chain] background sync failed', {
            networkId: candidate.networkId,
            accountIds: candidate.accountIds,
            reason: candidate.reason,
            ...describePrivacyChainError(e),
            e,
          });
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        }
      }

      // prune accounts that no longer exist so stale entries can't block
      // future rescans
      for (const staleId of Object.keys(this.backfillActiveByAccount)) {
        if (!seenAccountIds.has(staleId)) {
          delete this.backfillActiveByAccount[staleId];
        }
      }
      for (const runtimeStateKey of this.runtimeSyncState.keys()) {
        if (!seenRuntimeStateKeys.has(runtimeStateKey)) {
          this.runtimeSyncState.delete(runtimeStateKey);
        }
      }
      let boostStateChanged = false;
      for (const networkId of prunableNetworkIds) {
        if (
          !liveNetworkIds.has(networkId) &&
          this.foregroundBoostRequestedByNetwork[networkId]
        ) {
          delete this.foregroundBoostRequestedByNetwork[networkId];
          delete this.boostPausedByNetwork[networkId];
          boostStateChanged = true;
        }
      }
      await privacyChainAtom.set((value) => {
        const progress = Object.fromEntries(
          Object.entries(value.progress).filter(([key]) => {
            const separator = key.indexOf(':');
            const networkId = separator >= 0 ? key.slice(0, separator) : '';
            const accountId = separator >= 0 ? key.slice(separator + 1) : key;
            return (
              !prunableNetworkIds.has(networkId) ||
              seenAccountIds.has(accountId)
            );
          }),
        );
        return { ...value, progress };
      });
      if (boostStateChanged) {
        await this.publishBoostingNetworks();
      }
      if (anyStateChanged) {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
      }
      if (candidates.length > 1) {
        continueDelayMs = timerUtils.getTimeDurationMs({ seconds: 1 });
      } else if (retryNeeded) {
        // A fixed 30s error backoff ignored the person watching: with the
        // token-details page open a transient network failure froze visible
        // progress for half a minute. Hot networks retry on the foreground
        // cadence; unattended ones keep the calm backoff.
        const hot = candidates.some((c) =>
          this.isNetworkForegroundHot(c.networkId),
        );
        continueDelayMs = hot
          ? timerUtils.getTimeDurationMs({ seconds: 3 })
          : timerUtils.getTimeDurationMs({ seconds: 30 });
      }
    } catch (e) {
      // Structured fields, not the bare object: Android logs render a
      // thrown object as "[object Object]", which is exactly how a mobile
      // background failure becomes invisible.
      console.error('[privacy-chain] background sync tick failed', {
        name: e instanceof Error ? e.name : typeof e,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
    } finally {
      this.syncTickRunning = false;
      privacyChainPerfLog('bg sync tick', {
        ms: Date.now() - tickStartedAt,
        continueDelayMs: continueDelayMs ?? null,
      });
      if (this.syncTickRequested) {
        this.syncTickRequested = false;
        this.scheduleBackgroundSync(0);
      } else if (continueDelayMs !== undefined) {
        this.scheduleBackgroundSync(continueDelayMs);
      }
    }
  }

  // ---- removed-account GC ----

  gcRunning = false;

  async gcRemovedAccounts() {
    if (this.gcRunning) return;
    this.gcRunning = true;
    try {
      for (const networkId of await this.getLocalWalletNetworkIds()) {
        const vault = await vaultFactory.getChainOnlyVault({ networkId });
        const capability = requireLocalWalletCapability(vault);
        const { cleanupAccountIds } = await capability.listAccounts();
        for (const accountId of cleanupAccountIds) {
          const dbAccount =
            await this.backgroundApi.serviceAccount.getDBAccountSafe({
              accountId,
            });
          if (dbAccount) {
            // eslint-disable-next-line no-continue
            continue;
          }
          try {
            await capability.reset({ accountId, scope: 'all' });
            await this.backgroundApi.simpleDb.privacyChain.removeScanStartPrompted(
              { accountId },
            );
            await privacyChainAtom.set((value) => {
              const progress = Object.fromEntries(
                Object.entries(value.progress).filter(
                  ([key]) => key !== `${networkId}:${accountId}`,
                ),
              );
              return { ...value, progress };
            });
          } catch (e) {
            console.error('[privacy-chain] gc purge failed', {
              networkId,
              accountId,
              e,
            });
          }
        }
      }
      // Hand over the survivors, not the casualties: enumerating what to
      // delete would mean knowing what each chain keeps per wallet.
      // getWallets() hides passphrase wallets that are not unlocked this
      // session; those are still live and must keep their birthday state.
      const { wallets } =
        await this.backgroundApi.serviceAccount.getAllWallets();
      const liveWalletIds = wallets.map((w) => w.id);
      await this.forEachLocalWalletCapability((capability) =>
        capability.gcWalletState({ liveWalletIds }),
      );
    } catch (e) {
      console.error('[privacy-chain] gc failed', {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
    } finally {
      this.gcRunning = false;
    }
  }

  // ---- UI door ----

  private async clearAccountLocalHistory({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    const dbAccount = await this.backgroundApi.serviceAccount.getDBAccountSafe({
      accountId,
    });
    const [accountAddress, xpub] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        dbAccount,
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountXpub({
        dbAccount,
        accountId,
        networkId,
      }),
    ]);
    await this.backgroundApi.simpleDb.localHistory.clearAccountLocalHistory({
      networkId,
      accountAddress,
      xpub,
    });
  }

  repairMutexByAccount = new Map<string, Mutex>();

  private async repairLocalChainDataImpl(params: {
    networkId: string;
    accountId: string;
    mode: 'saved-birthday' | 'month' | 'height' | 'days';
    birthdayTimestamp?: number;
    birthdayHeight?: number;
    daysAgo?: number;
    forceReset?: boolean;
  }): Promise<void> {
    let mutex = this.repairMutexByAccount.get(params.accountId);
    if (!mutex) {
      mutex = new Mutex();
      this.repairMutexByAccount.set(params.accountId, mutex);
    }
    try {
      await mutex.runExclusive(() => this.runLocalChainDataRepair(params));
    } finally {
      if (!mutex.isLocked()) {
        this.repairMutexByAccount.delete(params.accountId);
      }
    }
  }

  private async runLocalChainDataRepair({
    networkId,
    accountId,
    mode,
    birthdayTimestamp,
    birthdayHeight,
    daysAgo,
    forceReset,
  }: {
    networkId: string;
    accountId: string;
    mode: 'saved-birthday' | 'month' | 'height' | 'days';
    birthdayTimestamp?: number;
    birthdayHeight?: number;
    daysAgo?: number;
    forceReset?: boolean;
  }): Promise<void> {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const capability = requireLocalWalletCapability(vault);
    const accountBackfillIsActive =
      this.backfillActiveByAccount[accountId] === true;
    let reuseActiveScan = false;
    if (mode === 'saved-birthday') {
      // Same start as the active scan, so reusing it is safe. This is the
      // ONLY mode allowed to shortcut: an explicit month/height below always
      // executes -- the old "reuse when the request doesn't deepen the scan"
      // shortcut silently swallowed the one repair that matters most, RAISING
      // the birthday to escape a runaway scan-from-the-floor.
      if (accountBackfillIsActive && !forceReset) {
        reuseActiveScan = true;
      } else {
        await capability.reset({ accountId, scope: 'cache' });
      }
    } else if (mode === 'height') {
      if (!Number.isSafeInteger(birthdayHeight) || (birthdayHeight ?? 0) <= 0) {
        throw new OneKeyLocalError('Enter a valid block height');
      }
      await capability.rescan({
        accountId,
        from: { type: 'height', height: birthdayHeight ?? 0 },
      });
    } else if (mode === 'month') {
      if (
        !Number.isFinite(birthdayTimestamp) ||
        (birthdayTimestamp ?? 0) <= 0 ||
        (birthdayTimestamp ?? 0) > Date.now()
      ) {
        throw new OneKeyLocalError('Enter a valid recovery date');
      }
      await capability.rescan({
        accountId,
        from: { type: 'timestamp', timestamp: birthdayTimestamp ?? 0 },
      });
    } else {
      if (!Number.isFinite(daysAgo) || (daysAgo ?? -1) < 0) {
        throw new OneKeyLocalError('Enter a valid recovery date');
      }
      await capability.rescan({
        accountId,
        from: { type: 'daysAgo', daysAgo: daysAgo ?? 0 },
      });
    }

    const aliasAccountIds = await capability.getAccountAliases({ accountId });
    await Promise.all(
      aliasAccountIds.map((aliasAccountId) =>
        this.clearAccountLocalHistory({
          networkId,
          accountId: aliasAccountId,
        }),
      ),
    );
    await privacyChainAtom.set((v) => {
      const progress = { ...v.progress };
      for (const aliasAccountId of aliasAccountIds) {
        delete progress[`${networkId}:${aliasAccountId}`];
      }
      return { ...v, progress };
    });
    this.backfillActiveByAccount = aliasAccountIds.reduce(
      (result, aliasAccountId) => ({
        ...result,
        [aliasAccountId]: true,
      }),
      { ...this.backfillActiveByAccount },
    );
    console.log('[privacy-chain] local chain data repair started', {
      networkId,
      accountId,
      mode,
      reuseActiveScan,
    });
    this.scheduleBackgroundSync(0);
    appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
    appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
  }

  // One repair transaction for every user-facing reset path: select the scan
  // lower bound, purge the rebuildable scanner cache, and clear the derived
  // local history. Keys, runtime account metadata, and funds are never removed.
  @backgroundMethod()
  async repairLocalChainData(params: {
    networkId: string;
    accountId: string;
    mode: 'saved-birthday' | 'month' | 'height';
    birthdayTimestamp?: number;
    birthdayHeight?: number;
  }): Promise<void> {
    await this.repairLocalChainDataImpl(params);
  }

  @backgroundMethod()
  async resetLocalChainData(params: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    await this.repairLocalChainDataImpl({
      ...params,
      mode: 'saved-birthday',
      forceReset: true,
    });
  }

  @backgroundMethod()
  async clearTransactionHistoryCache(): Promise<void> {
    const processedRuntimeAccounts = new Set<string>();
    for (const networkId of await this.getLocalWalletNetworkIds()) {
      // eslint-disable-next-line no-await-in-loop
      const vault = await vaultFactory.getChainOnlyVault({ networkId });
      const capability = requireLocalWalletCapability(vault);
      // eslint-disable-next-line no-await-in-loop
      const { accounts } = await capability.listAccounts();
      for (const { accountId, accountRuntimeKey } of accounts) {
        // eslint-disable-next-line no-await-in-loop
        const dbAccount =
          await this.backgroundApi.serviceAccount.getDBAccountSafe({
            accountId,
          });
        if (!dbAccount) {
          // Removed accounts are handled by the normal privacy-chain GC pass.
          // eslint-disable-next-line no-continue
          continue;
        }
        // Multiple app accounts can alias the same runtime-owned account.
        // The first repair already purges that shared scanner account and
        // clears every alias's derived history; repeating it would re-import
        // the just-purged account over the network only to delete it again.
        const runtimeAccountKey = `${networkId}:${accountRuntimeKey}`;
        if (processedRuntimeAccounts.has(runtimeAccountKey)) {
          // eslint-disable-next-line no-continue
          continue;
        }
        processedRuntimeAccounts.add(runtimeAccountKey);
        // eslint-disable-next-line no-await-in-loop
        await this.repairLocalChainDataImpl({
          networkId,
          accountId,
          mode: 'saved-birthday',
          forceReset: true,
        });
      }
    }
  }

  // ------------------------------------------------ per-account opt-in API
  //
  // Generic UI talks to these; the chain vault's ILocalWalletCapability does
  // the work. No caller outside a chain's own directory imports that chain's
  // service.

  private async requireAccountCapability(networkId: string) {
    const settings = await getVaultSettings({ networkId });
    if (!settings.localWallet) {
      throw new OneKeyLocalError(
        `privacyChain: ${networkId} is not a local-wallet network`,
      );
    }
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const capability = vault.getLocalWalletCapability();
    if (!capability) {
      throw new OneKeyLocalError(
        `privacyChain: local wallet capability missing for ${networkId}`,
      );
    }
    return capability;
  }

  @backgroundMethod()
  async getLocalWalletPools({
    networkId,
  }: {
    networkId: string;
  }): Promise<ILocalWalletPoolDescriptor[]> {
    const settings = await getVaultSettings({ networkId });
    return settings.localWallet?.pools ?? [];
  }

  @backgroundMethod()
  async getLocalWalletAccountState({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<ILocalWalletAccountState> {
    const capability = await this.requireAccountCapability(networkId);
    return capability.getAccountState({ accountId });
  }

  @backgroundMethod()
  async enableLocalWalletAccount({
    networkId,
    accountId,
    birthdayHeight,
    birthdayTimestamp,
  }: {
    networkId: string;
    accountId: string;
    birthdayHeight?: number;
    birthdayTimestamp?: number;
  }): Promise<void> {
    const capability = await this.requireAccountCapability(networkId);
    await this.assertEnabledAccountLimit({ networkId, accountId, capability });
    await capability.enableAccount({
      accountId,
      birthdayHeight,
      birthdayTimestamp,
    });
  }

  // Scan cost is linear in the number of distinct viewing keys the scanner
  // trial-decrypts against, so the ceiling counts keys, not app accounts:
  // aliases sharing one key are free and must not be refused.
  private async assertEnabledAccountLimit({
    networkId,
    accountId,
    capability,
  }: {
    networkId: string;
    accountId: string;
    capability: ILocalWalletCapability;
  }): Promise<void> {
    const settings = await getVaultSettings({ networkId });
    const limit = settings.localWallet?.maxEnabledAccounts;
    if (limit === undefined) {
      return;
    }
    const { accounts } = await capability.listAccounts();
    const enabledKeys = new Set(
      accounts
        .filter((account) => account.syncEnabled)
        .map((account) => account.accountRuntimeKey),
    );
    // A never-enabled account has no runtime identity yet, so it is absent
    // here: that correctly falls through to the ceiling check, because
    // enabling it does add a key.
    const targetKey = accounts.find(
      (account) => account.accountId === accountId,
    )?.accountRuntimeKey;
    if (targetKey !== undefined && enabledKeys.has(targetKey)) {
      return;
    }
    if (enabledKeys.size >= limit) {
      throw new OneKeyLocalError({
        message: `Privacy Mode is limited to ${limit} accounts at a time. Every enabled account is scanned against every block, so more of them slows syncing for all of them. Turn one off before enabling another.`,
        autoToast: true,
      });
    }
  }

  @backgroundMethod()
  async disableLocalWalletAccount({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    const capability = await this.requireAccountCapability(networkId);
    await capability.disableAccount({ accountId });
  }

  @backgroundMethod()
  async retryLocalWalletAccountSetup({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    const capability = await this.requireAccountCapability(networkId);
    await capability.retryAccountSetup({ accountId });
  }

  @backgroundMethod()
  async setLocalWalletAccountSendPreference({
    networkId,
    accountId,
    preferPublic,
  }: {
    networkId: string;
    accountId: string;
    preferPublic: boolean;
  }): Promise<void> {
    const capability = await this.requireAccountCapability(networkId);
    await capability.setAccountSendPreference({ accountId, preferPublic });
  }

  @backgroundMethod()
  async getLocalWalletAccountAddresses({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<ILocalWalletAccountAddresses | undefined> {
    const settings = await getVaultSettings({ networkId });
    if (!settings.localWallet) {
      return undefined;
    }
    const capability = await this.requireAccountCapability(networkId);
    const addresses = await capability.getAccountAddresses({ accountId });
    if (!addresses) {
      return undefined;
    }
    // Pausing stops trial decryption but keeps the cache and birthday, so the
    // address material is still on hand. Handing it out anyway would let a
    // payment land in a pool nothing is scanning; the receive entry has to go
    // with the scanner, not just the balance.
    const state = await capability.getAccountState({ accountId });
    if (!state.enabled) {
      return { ...addresses, privateAddress: undefined };
    }
    return addresses;
  }

  @backgroundMethod()
  async getLocalWalletAccountBalance({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<ILocalWalletAccountBalance | null> {
    const capability = await this.requireAccountCapability(networkId);
    return capability.getAccountBalance({ accountId });
  }

  @backgroundMethod()
  async deleteLocalWalletAccountData({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    const capability = await this.requireAccountCapability(networkId);
    await capability.deleteAccountData({ accountId });
  }

  // HD accounts on any local-wallet network, optionally within one wallet.
  // Settings pages and wallet menus list from here instead of matching a
  // chain impl.
  @backgroundMethod()
  async listLocalWalletAccounts({
    walletId,
  }: {
    walletId?: string;
  } = {}): Promise<ILocalWalletAccountListItem[]> {
    const networkIds = await this.getLocalWalletNetworkIds();
    if (networkIds.length === 0) {
      return [];
    }
    const networkIdByImpl = new Map<string, string>();
    for (const networkId of networkIds) {
      networkIdByImpl.set(
        networkUtils.getNetworkImpl({ networkId }),
        networkId,
      );
    }
    const [{ accounts }, { wallets }] = await Promise.all([
      this.backgroundApi.serviceAccount.getAllAccounts({ filterRemoved: true }),
      this.backgroundApi.serviceAccount.getWallets({
        nestedHiddenWallets: false,
      }),
    ]);
    const walletNames = new Map(wallets.map((w) => [w.id, w.name]));
    const items: ILocalWalletAccountListItem[] = [];
    accounts.forEach((account) => {
      const accountWalletId = accountUtils.getWalletIdFromAccountId({
        accountId: account.id,
      });
      const networkId =
        account.createAtNetwork ?? networkIdByImpl.get(account.impl);
      const isCandidate =
        !!networkId &&
        networkIds.includes(networkId) &&
        accountUtils.isHdAccount({ accountId: account.id }) &&
        walletNames.has(accountWalletId) &&
        (!walletId || accountWalletId === walletId);
      if (isCandidate) {
        items.push({
          accountId: account.id,
          accountName: account.name,
          walletId: accountWalletId,
          walletName: walletNames.get(accountWalletId) ?? '',
          networkId,
        });
      }
    });
    return items;
  }

  @backgroundMethod()
  async hasLocalWalletAccounts({
    walletId,
  }: {
    walletId?: string;
  } = {}): Promise<boolean> {
    return (await this.listLocalWalletAccounts({ walletId })).length > 0;
  }

  @backgroundMethod()
  async getLocalWalletSendPools({
    networkId,
    accountId,
    toAddress,
  }: {
    networkId: string;
    accountId: string;
    toAddress?: string;
  }): Promise<ILocalWalletSendPool[] | undefined> {
    const settings = await getVaultSettings({ networkId });
    if (!settings.localWallet) {
      return undefined;
    }
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    return vault
      .getLocalWalletCapability()
      ?.listSendPools?.({ accountId, toAddress });
  }

  @backgroundMethod()
  async getLocalWalletSyncProgress({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<ILocalWalletSyncProgress | undefined> {
    // Reading progress deliberately does NOT start a boost session: looking
    // at a balance is not the same as asking to spend battery on catching up.
    // The explicit triggers (Sync button, composing a send, switching to the
    // chain) are what start one.
    //
    // Answer from the last known value FIRST, then refresh in the background.
    //
    // The read itself is fast, but it shares one FIFO lane with the scan, and
    // during a boost the scan re-enters that lane every 500ms -- so opening
    // token details put three reads (progress, balance, history) behind up to
    // a pass each and the heights took ~10s to appear. Progress from a few
    // seconds ago is a correct answer to "how far along is it"; an empty
    // screen is not.
    const published = (await privacyChainAtom.get()).progress[
      `${networkId}:${accountId}`
    ];
    if (published) {
      return published;
    }
    // Nothing published yet (cold start, or this account has never been in a
    // pass). Pay the queued read once; the scheduler publishes from then on.
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    return requireLocalWalletCapability(vault).getSyncProgress({ accountId });
  }

  // Publishes this group's progress to the atom every reader subscribes to.
  //
  // Called from inside the tick, right after the pass that produced the new
  // state, so the read runs against a wallet this service already owns.
  async publishScanProgress(candidate: IPrivacyChainSyncCandidate) {
    try {
      const entries = await Promise.all(
        candidate.accountIds.map(async (accountId) => {
          const progress = await candidate.capability.getSyncProgress({
            accountId,
          });
          return [`${candidate.networkId}:${accountId}`, progress] as const;
        }),
      );
      await privacyChainAtom.set((v) => {
        const progress = { ...v.progress };
        const liveKeys = new Set(
          candidate.accountIds.map(
            (accountId) => `${candidate.networkId}:${accountId}`,
          ),
        );
        for (const key of Object.keys(progress)) {
          if (key.startsWith(`${candidate.networkId}:`) && !liveKeys.has(key)) {
            delete progress[key];
          }
        }
        for (const [key, value] of entries) {
          if (value) {
            progress[key] = value;
          }
        }
        return { ...v, progress };
      });
    } catch (e) {
      // Publishing is best-effort: a failure leaves subscribers on the last
      // good value, which is strictly better than clearing it.
      console.error('[privacy-chain] publish progress failed', {
        networkId: candidate.networkId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Keeps "a boost is running" and "something on screen says so" from drifting
  // apart: both now read the same published lists.
  //
  // Two lists, because a wanted-but-refused boost is a state the user has to
  // be able to act on: the light offers pause for the first and consent for
  // the second, and neither can be inferred from the other.
  async publishBoostingNetworks() {
    const requested = Object.keys(this.foregroundBoostRequestedByNetwork);
    const boostingNetworkIds = requested.filter((id) =>
      this.isNetworkForegroundHot(id),
    );
    const dataBlockedNetworkIds = requested.filter((id) =>
      this.isNetworkBoostBlockedByData(id),
    );
    await privacyChainAtom.set((v) => ({
      ...v,
      boostingNetworkIds,
      dataBlockedNetworkIds,
    }));
  }

  // The foreground pace, derived from the position the pass just published.
  //
  // Runs whenever this chain still has enough history left to be worth
  // explaining, until it is done or the user pauses. Metered data is NOT
  // checked here on purpose: a boost refused by gate two must stay REQUESTED,
  // because that is what puts the consent prompt on screen. Dropping the
  // request instead would leave a mobile-data user with a scan that quietly
  // never finishes and no way to allow it.
  async refreshAutoBoost(candidate: IPrivacyChainSyncCandidate): Promise<void> {
    const { networkId } = candidate;
    let maxRemaining: number | null = null;
    for (const accountId of candidate.accountIds) {
      // eslint-disable-next-line no-await-in-loop
      const remaining = await this.getPublishedRemainingBlocks({
        networkId,
        accountId,
      });
      if (
        remaining !== null &&
        (maxRemaining === null || remaining > maxRemaining)
      ) {
        maxRemaining = remaining;
      }
    }
    const wanted = shouldStartBoost({
      trigger: 'auto-backfill',
      networkId,
      remainingBlocks: maxRemaining,
      pausedByUser: this.boostPausedByNetwork[networkId],
      minRemainingBlocks:
        candidate.capability.syncPolicy.autoBoostMinRemainingBlocks,
    });
    const wasRequested = !!this.foregroundBoostRequestedByNetwork[networkId];
    if (wanted === wasRequested) {
      return;
    }
    if (wanted) {
      this.foregroundBoostRequestedByNetwork[networkId] = true;
    } else {
      delete this.foregroundBoostRequestedByNetwork[networkId];
    }
    console.log('[privacy-chain:sched] auto foreground pace', {
      networkId,
      on: wanted,
      remainingBlocks: maxRemaining,
    });
    await this.publishBoostingNetworks();
  }

  // One-time "where should scanning start?" prompt bookkeeping. The question
  // belongs to every client-scanning chain, so the flag lives in the
  // privacy-chain store; only the ANSWER (a height, a restore date) is
  // chain-shaped, and that stays with the chain.
  // Debug door: turn on per-read timing to find out why a read felt slow.
  // Deliberately not wired to any UI -- it is meant to be called from a
  // console while reproducing, and left off the rest of the time.
  @backgroundMethod()
  async setPrivacyChainPerfTrace({
    networkId,
    enabled,
  }: {
    networkId: string;
    enabled: boolean;
  }): Promise<void> {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    await requireLocalWalletCapability(vault).setDiagnosticsEnabled?.({
      enabled,
    });
  }

  @backgroundMethod()
  async getScanStartPrompted({
    accountId,
  }: {
    accountId: string;
  }): Promise<boolean> {
    return this.backgroundApi.simpleDb.privacyChain.getScanStartPrompted({
      accountId,
    });
  }

  @backgroundMethod()
  async markScanStartPrompted({
    accountId,
  }: {
    accountId: string;
  }): Promise<void> {
    await this.backgroundApi.simpleDb.privacyChain.markScanStartPrompted({
      accountId,
    });
  }

  // Viewing-level repair through the capability. A chain-only vault is enough
  // because no keyring/password is needed.
  @backgroundMethod()
  async rescanFromDaysAgo({
    networkId,
    accountId,
    daysAgo,
  }: {
    networkId: string;
    accountId: string;
    daysAgo: number;
  }): Promise<void> {
    await this.repairLocalChainDataImpl({
      networkId,
      accountId,
      mode: 'days',
      daysAgo,
    });
  }

  // Same capability repair, given an explicit height -- the UI's "I know the
  // exact block" input mode.
  @backgroundMethod()
  async rescanFromHeight({
    networkId,
    accountId,
    birthdayHeight,
  }: {
    networkId: string;
    accountId: string;
    birthdayHeight: number;
  }): Promise<void> {
    await this.repairLocalChainDataImpl({
      networkId,
      accountId,
      mode: 'height',
      birthdayHeight,
    });
  }
}

export default ServicePrivacyChain;
