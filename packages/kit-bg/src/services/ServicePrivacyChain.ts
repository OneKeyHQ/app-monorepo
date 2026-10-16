import { Mutex } from 'async-mutex';

import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
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
  getPrivacyChainBlocksLeft,
  shouldStartBoost,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import type { IPrivacyChainBoostTrigger } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { privacyChainAtom } from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';
import {
  listLastLocalWalletBalanceAccountIds,
  removeLastLocalWalletBalances,
  removeNetworkLastLocalWalletBalances,
} from '../vaults/localWallet/privacyChainCacheStore';
import { isLocalWalletStorageUnsupportedError } from '../vaults/localWallet/storageSupport';
import {
  getLocalWalletViewingKey,
  listLocalWalletViewingKeyAccountIds,
  removeLocalWalletViewingKeys,
  saveLocalWalletViewingKey,
} from '../vaults/localWallet/viewingKeyStore';
import { getVaultSettings } from '../vaults/settings';

import {
  getPrivacyChainFailureBackoffMs,
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
  ILocalWalletReviewedTransaction,
  ILocalWalletSendPool,
  ILocalWalletSlotUsage,
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

// Chain-agnostic singleton behind vaultSettings.localWallet: runs the
// background sync scheduler, removed-account GC, and the only UI-callable
// entry point into local-wallet vault capabilities.
export type ILocalWalletAccountListItem = {
  accountId: string;
  accountName: string;
  walletId: string;
  walletName: string;
  networkId: string;
  // The wallet was created with 'do not save'. Enabling still writes a viewing
  // key to disk, so the enable flow has to disclose that before opting in.
  walletIsTemp: boolean;
  // Set when the chain has more than one derive type: two accounts at the same
  // index (e.g. Monero "Trezor" and "Cake Wallet") share a name otherwise.
  deriveLabel?: string;
};

// Upper bound on the per-network head request inside a tick. Generous: a
// slow node is fine, a node that never answers is not.
const PRIVACY_CHAIN_TIP_REQUEST_TIMEOUT_MS = 30_000;

// Loading a runtime cold on mobile can take seconds; past this it is not coming.
const PRIVACY_CHAIN_DROP_LOCAL_DATA_TIMEOUT_MS = 30_000;

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
    // A node edit must never fail or wait on privacy-chain work.
    appEventBus.on(EAppEventBusNames.CustomRpcChanged, ({ networkIds }) => {
      void this.onLocalWalletNodeChanged({ networkIds }).catch((error) => {
        console.error('[privacy-chain] node change handling failed', {
          ...describePrivacyChainError(error),
        });
      });
    });
  }

  // Fans an event out to every opted-in chain; this service has no opinion
  // on what each chain does with it.
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

  initialized = false;

  initPromise: Promise<void> | undefined;

  // No sync tick fires before `earliestTickAt`: 60s after construction by
  // default, shortened to a 30s floor once the user explicitly waits on this
  // chain. Reads (balance, progress) are never held back by this.
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
        // Prime the cellular consent the synchronous gates read; left at its
        // default, the first Sync after launch asked for consent already given.
        await this.isPrivacySyncOnCellularAllowed().catch(() => false);
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
    // Guards against re-creating the runtime database mid-reset; setTimeout
    // isn't covered by resetUtils' setInterval switch.
    if (resetUtils.getIsResetting()) {
      return;
    }
    // Clamped to the startup quiet window; inert once the window has passed.
    const effectiveDelayMs = Math.max(
      delayMs,
      this.earliestTickAt - Date.now(),
    );
    const dueAt = Date.now() + effectiveDelayMs;
    if (this.syncTimer) {
      // An earlier request wins: "sync now" must not wait out a 30s idle
      // timer that happened to be pending.
      if (this.syncTimerDueAt !== undefined && this.syncTimerDueAt <= dueAt) {
        return;
      }
      clearTimeout(this.syncTimer);
    }
    this.syncTimerDueAt = dueAt;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = undefined;
      void this.backgroundSyncTick();
    }, effectiveDelayMs);
  }

  // Foreground boost is a SESSION started explicitly (Sync button), running
  // until backfill finishes or the user leaves/dismisses it; reading
  // progress never starts one.
  foregroundBoostRequestedByNetwork: Record<string, boolean> = {};

  // Networks the user paused: stops scanning outright (not just the
  // foreground pace) and survives a restart. Mirrors simpleDb so the
  // scheduler can answer synchronously; primed in init().
  boostPausedByNetwork: Record<string, boolean> = {};

  // Groups whose last turns failed: they skip picks until `untilMs` so a
  // failing chain cannot starve the others (see getPrivacyChainFailureBackoffMs).
  syncFailureBackoff = new Map<string, { failures: number; untilMs: number }>();

  // A user action (Sync, enable, a node change) is a fresh reason to try now.
  clearSyncFailureBackoff(networkId: string) {
    for (const key of this.syncFailureBackoff.keys()) {
      if (key.startsWith(`${networkId}|`)) {
        this.syncFailureBackoff.delete(key);
      }
    }
  }

  recordSyncFailure(runtimeStateKey: string) {
    const failures =
      (this.syncFailureBackoff.get(runtimeStateKey)?.failures ?? 0) + 1;
    this.syncFailureBackoff.set(runtimeStateKey, {
      failures,
      untilMs: Date.now() + getPrivacyChainFailureBackoffMs(failures),
    });
  }

  // Viewing material for an account, rebuilt from the mnemonic when missing
  // (Prime transfer, cloud restore, older builds) with a cached password only;
  // never prompts. Undefined while locked: the next use after unlock fills it,
  // so unlock itself does no per-account work for users without these chains.
  async ensureLocalWalletViewingKey({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<string | undefined> {
    const stored = await getLocalWalletViewingKey({
      backgroundApi: this.backgroundApi,
      networkId,
      accountId,
    });
    if (stored) return stored;
    if (!accountUtils.isHdAccount({ accountId })) return undefined;
    // Account-bound: deriving needs the account's keyring.
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const derive = vault.getLocalWalletCapability()?.deriveViewingKey;
    if (!derive) return undefined;
    const password =
      (await this.backgroundApi.servicePassword.hasCachedPassword())
        ? await this.backgroundApi.servicePassword.getCachedPassword()
        : undefined;
    if (!password) return undefined;
    const value = await derive({ accountId, password });
    await saveLocalWalletViewingKey({
      backgroundApi: this.backgroundApi,
      networkId,
      accountId,
      value,
    });
    return value;
  }

  // Called as soon as a password is cached (unlock, or any prompt): work that
  // needs it, Monero key images, should not wait for the next sync pass.
  async runLocalWalletPasswordWork(): Promise<void> {
    for (const networkId of await this.getLocalWalletNetworkIds()) {
      // eslint-disable-next-line no-await-in-loop
      const vault = await vaultFactory.getChainOnlyVault({ networkId });
      const { accounts } =
        // eslint-disable-next-line no-await-in-loop
        await requireLocalWalletCapability(vault).listAccounts();
      const accountIds = accounts
        .filter(({ syncEnabled }) => syncEnabled)
        .map(({ accountId }) => accountId);
      if (
        accountIds.length &&
        // eslint-disable-next-line no-await-in-loop
        (await this.doLocalWalletPasswordWork({ networkId, accountIds }))
      ) {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
      }
    }
  }

  // The user asked to confirm funds that need the password: prompt even when
  // background work would not (re-enter-every-time is on, or nothing cached).
  @backgroundMethod()
  async verifyLocalWalletWithPassword({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    if (!(await vault.localWalletHasPasswordWork())) {
      return;
    }
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
      });
    await vault.localWalletDoPasswordWork({ password });
    appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
  }

  // Finishes password-gated work using only a cached password; never
  // prompts. A failure is logged, not raised -- the scan already succeeded.
  async doLocalWalletPasswordWork(
    candidate: Pick<IPrivacyChainSyncCandidate, 'networkId' | 'accountIds'>,
  ): Promise<boolean> {
    let changed = false;
    try {
      if (!(await this.backgroundApi.servicePassword.hasCachedPassword())) {
        return false;
      }
      for (const accountId of candidate.accountIds) {
        // eslint-disable-next-line no-await-in-loop
        const vault = await vaultFactory.getVault({
          networkId: candidate.networkId,
          accountId,
        });
        // eslint-disable-next-line no-await-in-loop
        if (!(await vault.localWalletHasPasswordWork())) {
          // eslint-disable-next-line no-continue
          continue;
        }
        // Never prompts: skips when the user requires re-entry on every transaction.
        if (
          // eslint-disable-next-line no-await-in-loop
          await this.backgroundApi.servicePassword.isAlwaysReenterPassword(
            EReasonForNeedPassword.CreateTransaction,
          )
        ) {
          return changed;
        }
        const password =
          // eslint-disable-next-line no-await-in-loop
          await this.backgroundApi.servicePassword.getCachedPassword();
        if (!password) {
          return changed;
        }
        // eslint-disable-next-line no-await-in-loop
        if (await vault.localWalletDoPasswordWork({ password })) {
          changed = true;
        }
      }
    } catch (e) {
      console.error('[privacy-chain] password work failed', {
        networkId: candidate.networkId,
        ...describePrivacyChainError(e),
      });
    }
    return changed;
  }

  // Blocks left to scan, from the last published position (reading off the
  // atom avoids queuing behind a pass). Null means "not known yet".
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
    return getPrivacyChainBlocksLeft(
      (await privacyChainAtom.get()).progress[`${networkId}:${accountId}`],
    );
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
    if (trigger === 'manual-sync') {
      this.clearSyncFailureBackoff(networkId);
    }
    if (
      !shouldStartBoost({
        trigger,
        networkId,
        remainingBlocks,
        pausedByUser: this.boostPausedByNetwork[networkId],
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
    // Pulls a pending, later timer forward (see scheduleBackgroundSync).
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

  // Pausing is a STATEMENT distinct from stopForegroundBoost's lifecycle
  // signal: it outlasts page visits and only Sync clears it. Stops the
  // foreground pace only; background sync keeps running.
  @backgroundMethod()
  async pauseLocalWalletScan({
    networkId,
  }: {
    networkId: string;
  }): Promise<void> {
    // Session-scoped on purpose: resets to the default (scan on Wi-Fi, hold
    // on metered data) on every restart.
    this.boostPausedByNetwork[networkId] = true;
    console.log('[privacy-chain:sched] scanning PAUSED by user', { networkId });
    await this.publishBoostingNetworks();
  }

  // Gate two: device cellular state, reported by the UI (only it can see
  // NetInfo). Native starts unknown and fails closed until main reports it
  // across the split-runtime boundary; other targets start non-cellular.
  deviceIsCellular: boolean | undefined = platformEnv.isNative
    ? undefined
    : false;

  // Persisted cellular-data consent (not per-session). Mirrored here so the
  // synchronous scheduler tick can answer gate two without awaiting storage.
  private allowCellularSyncCache = false;

  async isPrivacySyncOnCellularAllowed(): Promise<boolean> {
    this.allowCellularSyncCache =
      await this.backgroundApi.simpleDb.privacyChain.getAllowCellularSync();
    return this.allowCellularSyncCache;
  }

  async isLocalWalletScanAllowed(): Promise<boolean> {
    return isPrivacySyncSchedulingAllowed({
      deviceIsCellular: this.deviceIsCellular,
      allowPrivacySyncOnCellular: await this.isPrivacySyncOnCellularAllowed(),
    });
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
    await this.backgroundApi.simpleDb.privacyChain.setAllowCellularSync({
      allow,
    });
    this.allowCellularSyncCache = allow;
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
      !this.allowCellularSyncCache
    );
  }

  // Read synchronously by the scheduler tick, so gate two is answered from
  // the primed cache rather than the db (see init).
  isNetworkForegroundHot(networkId: string): boolean {
    if (!this.foregroundBoostRequestedByNetwork[networkId]) {
      return false;
    }
    // A pause is its own state, not a missing request: the light needs it.
    if (this.boostPausedByNetwork[networkId]) {
      return false;
    }
    return !this.isNetworkBoostBlockedByData(networkId);
  }

  async onLocalWalletNodeChanged({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<void> {
    const localWalletNetworkIds = await this.getLocalWalletNetworkIds();
    const changed = networkIds.filter((networkId) =>
      localWalletNetworkIds.includes(networkId),
    );
    if (!changed.length) return;
    changed.forEach((networkId) => this.clearSyncFailureBackoff(networkId));
    this.scheduleBackgroundSync(0);
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
    appEventBus.emit(EAppEventBusNames.LocalWalletAccountsChanged, {
      networkId,
      accountIds,
    });
    this.clearSyncFailureBackoff(networkId);
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
    if (backfillActive && !this.boostPausedByNetwork[networkId]) {
      // An explicit enable needs a visible progress/consent control even
      // before the scheduler can publish the first scanned block.
      this.foregroundBoostRequestedByNetwork[networkId] = true;
      await this.publishBoostingNetworks();
    }
    this.scheduleBackgroundSync(0);
    appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
    appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
  }

  // Wipes every client-side scan database before app storage clears (vault
  // settings must still resolve). Each chain is wiped independently and
  // time-bounded so one stuck runtime can't block the rest.
  // Returns the networks whose wipe failed so the caller can mark them for
  // retry after app storage clears.
  @backgroundMethod()
  async dropAllLocalWalletData(): Promise<string[]> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
    }
    const pendingDrop =
      await this.backgroundApi.simpleDb.privacyChain.getPendingLocalDataDrop();
    // Loading a runtime only to find nothing would slow every reset for
    // users who never used a privacy chain.
    const networkIds: string[] = [];
    for (const networkId of await this.getLocalWalletNetworkIds()) {
      let mayHoldData = true;
      try {
        // eslint-disable-next-line no-await-in-loop
        const vault = await vaultFactory.getChainOnlyVault({ networkId });
        const hasLocalData = vault.getLocalWalletCapability()?.hasLocalData;
        if (hasLocalData && !pendingDrop.includes(networkId)) {
          // eslint-disable-next-line no-await-in-loop
          mayHoldData = await hasLocalData();
        }
      } catch {
        // Unknown state: wipe it.
      }
      if (mayHoldData) {
        networkIds.push(networkId);
      }
    }
    if (networkIds.length === 0) {
      return [];
    }
    // An in-flight scan holds the runtime; deleting without stopping it
    // first can leave the database (and its viewing keys) on disk.
    if (this.syncTickRunning) {
      for (const networkId of networkIds) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const vault = await vaultFactory.getChainOnlyVault({ networkId });
          // eslint-disable-next-line no-await-in-loop
          await vault.getLocalWalletCapability()?.recoverFromTimeout();
        } catch (e) {
          console.error('[privacy-chain] could not stop a scan before reset', {
            networkId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      const waitUntil = Date.now() + PRIVACY_CHAIN_DROP_LOCAL_DATA_TIMEOUT_MS;
      while (this.syncTickRunning && Date.now() < waitUntil) {
        // eslint-disable-next-line no-await-in-loop
        await timerUtils.wait(200);
      }
    }
    const failedNetworkIds: string[] = [];
    for (const networkId of networkIds) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const vault = await vaultFactory.getChainOnlyVault({ networkId });
        const drop = vault.getLocalWalletCapability()?.dropLocalData?.();
        await Promise.race([
          drop,
          new Promise((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new OneKeyLocalError('dropLocalData timed out')),
              PRIVACY_CHAIN_DROP_LOCAL_DATA_TIMEOUT_MS,
            );
          }),
        ]);
      } catch (e) {
        failedNetworkIds.push(networkId);
        console.error('[privacy-chain] could not wipe local scan data', {
          networkId,
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        clearTimeout(timer);
      }
    }
    return failedNetworkIds;
  }

  @backgroundMethod()
  async markLocalDataDropPending({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<void> {
    await this.backgroundApi.simpleDb.privacyChain.setPendingLocalDataDrop({
      networkIds,
    });
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

  syncTickRunning = false;

  // Accounts whose last pass left backfill queued; read by the rescan door
  // below to cap concurrent deep rescans.
  backfillActiveByAccount: Record<string, boolean> = {};

  runtimeSyncState = new Map<string, IPrivacyChainRuntimeState>();

  // Promise.race doesn't cancel the losing sync. Quarantine the runtime
  // until its writer finishes or the carrier confirms replacement, or a
  // second lease could write the same wallet DB concurrently.
  quarantinedSyncs = new Map<string, Promise<unknown>>();

  // Only an app restart (after updating the WebView) can change this.
  storageUnsupportedNetworkIds = new Set<string>();

  private async noteStorageUnsupported(
    networkId: string,
    error: unknown,
  ): Promise<void> {
    if (
      !isLocalWalletStorageUnsupportedError(error) ||
      this.storageUnsupportedNetworkIds.has(networkId)
    ) {
      return;
    }
    this.storageUnsupportedNetworkIds.add(networkId);
    console.error('[privacy-chain] storage unsupported on this device', {
      networkId,
      ...describePrivacyChainError(error),
    });
    const storageUnsupportedNetworkIds = [...this.storageUnsupportedNetworkIds];
    await privacyChainAtom.set((value) => ({
      ...value,
      storageUnsupportedNetworkIds,
    }));
  }

  lastBackfillRuntimeStateKey: string | undefined;

  // A tick requested while one is running (account/network/cellular change)
  // must not wait for the next 5-minute poll.
  syncTickRequested = false;

  syncTickStartedAt = 0;

  syncTickBusyLoggedAt = 0;

  async backgroundSyncTick() {
    if (resetUtils.getIsResetting()) {
      return;
    }
    if (this.syncTickRunning) {
      this.syncTickRequested = true;
      // A tick that never returns stops every chain with nothing else in
      // the log. Say so, at most every 15s.
      const runningMs = Date.now() - this.syncTickStartedAt;
      if (Date.now() - this.syncTickBusyLoggedAt > 15_000) {
        this.syncTickBusyLoggedAt = Date.now();
        console.log(
          '[privacy-chain:sched] tick refused: previous still running',
          {
            runningMs,
          },
        );
      }
      return;
    }
    this.syncTickRunning = true;
    const tickStartedAt = Date.now();
    this.syncTickStartedAt = tickStartedAt;
    // Why each network did not become a candidate this tick. Logged below
    // with the pick, so "the chain is not scanning" always has a stated cause.
    const notCandidate: Record<string, string> = {};
    let continueDelayMs: number | undefined;
    try {
      if (!(await this.isLocalWalletScanAllowed())) {
        // Must publish before returning, or the consent toggle (driven by
        // published progress) disappears while scanning is held.
        await this.publishHeldScanProgress();
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
            notCandidate[networkId] = 'no-enabled-accounts';
            // eslint-disable-next-line no-continue
            continue;
          }
          const groups = new Map<string, string[]>();
          for (const { accountId, runtimeKey } of accounts) {
            // eslint-disable-next-line no-await-in-loop
            const dbAccount =
              await this.backgroundApi.serviceAccount.getDBAccountSafe({
                accountId,
              });
            if (!dbAccount) {
              // Deleted: removal GC purges it, pending transaction or not.
              // A missed removal event is picked up here.
              void this.gcRemovedAccounts();
              // eslint-disable-next-line no-continue
              continue;
            }
            seenAccountIds.add(accountId);
            liveNetworkIds.add(networkId);
            const group = groups.get(runtimeKey) ?? [];
            group.push(accountId);
            groups.set(runtimeKey, group);
          }
          // Liveness is fully known only here, so only here is destructive pruning
          // of old UI state safe; a later tip failure must not wipe it.
          prunableNetworkIds.add(networkId);
          if (groups.size === 0) {
            notCandidate[networkId] = 'no-live-accounts';
            // eslint-disable-next-line no-continue
            continue;
          }
          // A paused chain does no work at all, not even the tip request; every
          // scan trigger funnels through this one check.
          if (this.boostPausedByNetwork[networkId]) {
            notCandidate[networkId] = 'paused-by-user';
            // eslint-disable-next-line no-continue
            continue;
          }
          // Bounded manually: this await sits outside the watchdog, and a head
          // request that never answers would hold syncTickRunning forever, silently
          // stalling every chain.
          let tipTimer: ReturnType<typeof setTimeout> | undefined;
          // eslint-disable-next-line no-await-in-loop
          const chainTip = await Promise.race([
            capability.getChainTip(),
            new Promise<never>((_, reject) => {
              tipTimer = setTimeout(() => {
                reject(
                  new OneKeyLocalError(
                    'privacy-chain: chain tip request timed out',
                  ),
                );
              }, PRIVACY_CHAIN_TIP_REQUEST_TIMEOUT_MS);
            }),
          ]).finally(() => clearTimeout(tipTimer));
          for (const [runtimeKey, rawAccountIds] of groups) {
            const groupedAccountIds = rawAccountIds.toSorted();
            const runtimeStateKey = `${networkId}|${runtimeKey}`;
            const accountSignature = groupedAccountIds.join('|');
            seenRuntimeStateKeys.add(runtimeStateKey);
            const previous = this.runtimeSyncState.get(runtimeStateKey);
            const hasBackfill = groupedAccountIds.some(
              (accountId) => this.backfillActiveByAccount[accountId],
            );
            const reason = getPrivacyChainSyncReason({
              previous,
              accountSignature,
              chainTip,
              hasBackfill,
            });
            if (!reason) {
              notCandidate[runtimeStateKey] =
                `up-to-date(tip=${String(chainTip)})`;
            }
            if (reason) {
              candidates.push({
                networkId,
                runtimeStateKey,
                accountIds: groupedAccountIds,
                accountSignature,
                chainTip,
                reason,
                capability,
              });
            }
          }
        } catch (e) {
          retryNeeded = true;
          notCandidate[networkId] = `enumeration-failed: ${
            e instanceof Error ? e.message : String(e)
          }`;
          console.error('[privacy-chain] network enumeration failed', {
            networkId,
            ...describePrivacyChainError(e),
          });
        }
      }

      const pickedAtMs = Date.now();
      const backedOff = candidates.filter(
        ({ runtimeStateKey }) =>
          (this.syncFailureBackoff.get(runtimeStateKey)?.untilMs ?? 0) >
          pickedAtMs,
      );
      const runnableCandidates = candidates.filter(
        (c) =>
          !this.quarantinedSyncs.has(c.runtimeStateKey) &&
          !backedOff.includes(c) &&
          !this.storageUnsupportedNetworkIds.has(c.networkId),
      );
      const candidate = pickPrivacyChainSyncCandidate(
        runnableCandidates,
        this.lastBackfillRuntimeStateKey,
      );
      // One line per tick: who wanted a turn, who got it, and why every other
      // network did not. `tip` outranks `backfill`.
      console.log('[privacy-chain:sched] pick', {
        picked: candidate
          ? `${candidate.runtimeStateKey}:${candidate.reason}`
          : null,
        candidates: candidates.map((c) => `${c.runtimeStateKey}:${c.reason}`),
        backedOff: backedOff.map((c) => c.runtimeStateKey),
        quarantined: candidates
          .filter((c) => this.quarantinedSyncs.has(c.runtimeStateKey))
          .map((c) => c.runtimeStateKey),
        notCandidate,
      });
      if (candidate) {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let syncPromise: ReturnType<
          ILocalWalletCapability['syncGroup']
        > | null = null;
        try {
          // One bounded group turn (journal replay + registration + sync). A
          // newly-added viewing key requeues only completed ranges.
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
              const arm = () => {
                timeoutHandle = setTimeout(() => {
                  // Waiting behind a send is not a stuck sync; give it a
                  // full window once the send is done.
                  if (candidate.capability.isUserOperationActive?.()) {
                    arm();
                    return;
                  }
                  reject(
                    new OneKeyLocalError(
                      'privacy-chain: wallet-runtime sync timed out',
                    ),
                  );
                }, candidate.capability.syncPolicy.maxSyncDurationMs);
              };
              arm();
            }),
          ]);
          anyStateChanged = !!result.stateChanged;
          if (result.synced) {
            this.syncFailureBackoff.delete(candidate.runtimeStateKey);
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
            this.recordSyncFailure(candidate.runtimeStateKey);
          }
          for (const accountId of candidate.accountIds) {
            this.backfillActiveByAccount[accountId] =
              !!result.backfillRemaining;
          }
          // Publish while the wallet is still ours, so readers subscribe to this
          // instead of each polling (and queuing behind a pass).
          await this.publishScanProgress(candidate);
          if (
            result.synced &&
            (await this.doLocalWalletPasswordWork(candidate))
          ) {
            anyStateChanged = true;
          }
          // Derive the pace from the pass's own published state, not from a page
          // asking -- so the boost tracks sync distance, not which screen is open.
          await this.refreshAutoBoost(candidate);
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
          // The watchdog only abandons the await; it doesn't cancel the operation.
          // Quarantine the losing promise below -- in-thread carriers must not
          // swap leases and start a concurrent writer.
          const isWatchdogTimeout =
            e instanceof Error &&
            (e.message.includes('wallet-runtime sync timed out') ||
              e.message.includes('WebEmbed bridge call timeout'));
          if (!isWatchdogTimeout) {
            // Timeouts are held back by quarantine instead.
            this.recordSyncFailure(candidate.runtimeStateKey);
          }
          await this.noteStorageUnsupported(candidate.networkId, e);
          if (isWatchdogTimeout) {
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
          // `message` is only an opaque code; `params.operation`/`detail` carry the
          // actual failing call and upstream text (incl. block height) -- needed
          // since one bad account fails the whole group.
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
      if (runnableCandidates.length > 1) {
        continueDelayMs = timerUtils.getTimeDurationMs({ seconds: 1 });
      } else if (!runnableCandidates.length && backedOff.length) {
        // Everything that wants a turn is backing off: wake when the first
        // backoff ends rather than on the fixed error cadence.
        continueDelayMs = Math.max(
          timerUtils.getTimeDurationMs({ seconds: 1 }),
          Math.min(
            ...backedOff.map(
              (c) =>
                (this.syncFailureBackoff.get(c.runtimeStateKey)?.untilMs ??
                  pickedAtMs) - Date.now(),
            ),
          ),
        );
      } else if (retryNeeded) {
        // Hot (foreground) networks retry faster than the calm background
        // backoff, so a transient failure doesn't freeze visible progress.
        const hot = candidates.some((c) =>
          this.isNetworkForegroundHot(c.networkId),
        );
        continueDelayMs = hot
          ? timerUtils.getTimeDurationMs({ seconds: 3 })
          : timerUtils.getTimeDurationMs({ seconds: 30 });
      }
    } catch (e) {
      // Structured fields, not the bare error object: Android logs render a
      // thrown object as "[object Object]", hiding background failures.
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

  gcRunning = false;

  // A removal while a pass runs may land after that pass listed accounts.
  gcRequested = false;

  async gcRemovedAccounts() {
    if (this.gcRunning) {
      this.gcRequested = true;
      return;
    }
    this.gcRunning = true;
    try {
      for (const networkId of await this.getLocalWalletNetworkIds()) {
        let capability: ILocalWalletCapability;
        let cleanupAccountIds: string[];
        try {
          const vault = await vaultFactory.getChainOnlyVault({ networkId });
          capability = requireLocalWalletCapability(vault);
          ({ cleanupAccountIds } = await capability.listAccounts());
        } catch (e) {
          // One chain that cannot list its accounts must not stop the others.
          console.error('[privacy-chain] gc list failed', {
            networkId,
            error: e instanceof Error ? e.message : String(e),
          });
          // eslint-disable-next-line no-continue
          continue;
        }
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
      const orphanViewingKeys: string[] = [];
      for (const accountId of await listLocalWalletViewingKeyAccountIds({
        backgroundApi: this.backgroundApi,
      })) {
        if (
          // eslint-disable-next-line no-await-in-loop
          !(await this.backgroundApi.serviceAccount.getDBAccountSafe({
            accountId,
          }))
        ) {
          orphanViewingKeys.push(accountId);
        }
      }
      await removeLocalWalletViewingKeys({
        backgroundApi: this.backgroundApi,
        accountIds: orphanViewingKeys,
      });
      const orphanLastBalances: string[] = [];
      for (const accountId of await listLastLocalWalletBalanceAccountIds({
        backgroundApi: this.backgroundApi,
      })) {
        if (
          // eslint-disable-next-line no-await-in-loop
          !(await this.backgroundApi.serviceAccount.getDBAccountSafe({
            accountId,
          }))
        ) {
          orphanLastBalances.push(accountId);
        }
      }
      await removeLastLocalWalletBalances({
        backgroundApi: this.backgroundApi,
        accountIds: orphanLastBalances,
      });
      // Passes survivors, not casualties: getWallets() hides locked passphrase
      // wallets, which are still live and must keep their state.
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
      if (this.gcRequested) {
        this.gcRequested = false;
        void this.gcRemovedAccounts();
      }
    }
  }

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
      // Only 'saved-birthday' may shortcut (reusing the active scan's start is
      // safe); explicit month/height repairs always run in full.
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
    if (!reuseActiveScan) {
      // The rescan rebuilds the balance; the saved one may count funds it no
      // longer covers.
      await removeLastLocalWalletBalances({
        backgroundApi: this.backgroundApi,
        accountIds: aliasAccountIds,
      });
    }
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

  // Single repair transaction for every reset path: sets the scan lower
  // bound, purges rebuildable cache, clears derived history. Never touches
  // keys or funds.
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
  async clearTransactionHistoryCache(params?: {
    networkId: string;
  }): Promise<void> {
    const processedRuntimeAccounts = new Set<string>();
    const networkIds = params
      ? [params.networkId]
      : await this.getLocalWalletNetworkIds();
    for (const networkId of networkIds) {
      // eslint-disable-next-line no-await-in-loop
      const vault = await vaultFactory.getChainOnlyVault({ networkId });
      const capability = requireLocalWalletCapability(vault);
      if (capability.resetStorage) {
        // eslint-disable-next-line no-await-in-loop
        await capability.resetStorage();
        // eslint-disable-next-line no-await-in-loop
        await removeNetworkLastLocalWalletBalances({
          backgroundApi: this.backgroundApi,
          networkId,
        });
      }
      // eslint-disable-next-line no-await-in-loop
      const { accounts } = await capability.listAccounts();
      for (const {
        accountId,
        accountRuntimeKey,
        slotEnabled,
        syncEnabled,
      } of accounts) {
        // A paused account keeps its data and resume position; resetting it
        // here would turn "resume" into a rescan from the birthday.
        if (!(slotEnabled ?? syncEnabled)) {
          // eslint-disable-next-line no-continue
          continue;
        }
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
        // Aliases share one runtime account; the first repair already purges it
        // and clears all alias history, so skip repeats here.
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

  // Generic UI talks to these; the chain vault's ILocalWalletCapability does
  // the work. No caller outside a chain's own directory imports its service.

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

  /**
   * Whether this account's wallet type can use local-wallet scanning at
   * all. Checked via the chain's keyringMap, so hardware/watch-only/
   * imported accounts aren't offered a toggle their keyring would refuse.
   */
  @backgroundMethod()
  async isLocalWalletAccountSupported({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<boolean> {
    const settings = await getVaultSettings({ networkId });
    if (!settings.localWallet) {
      return false;
    }
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    return vault.supportsAccountWalletType({ accountId });
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

  enableMutexByNetwork = new Map<string, Mutex>();

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
    let mutex = this.enableMutexByNetwork.get(networkId);
    if (!mutex) {
      mutex = new Mutex();
      this.enableMutexByNetwork.set(networkId, mutex);
    }
    await mutex.runExclusive(async () => {
      const capability = await this.requireAccountCapability(networkId);
      await this.assertEnabledAccountLimit({
        networkId,
        accountId,
        capability,
      });
      try {
        await capability.enableAccount({
          accountId,
          birthdayHeight,
          birthdayTimestamp,
        });
      } catch (error) {
        await this.noteStorageUnsupported(networkId, error);
        throw error;
      }
    });
  }

  // Ceiling counts distinct viewing keys, not app accounts -- aliases
  // sharing one key are free. Public so callers that enable directly (debug
  // gallery, repair panel) can check first: refusing after the key is
  // registered means its scan cost was already paid.
  async assertEnabledAccountLimit({
    networkId,
    accountId,
    capability,
  }: {
    networkId: string;
    accountId: string;
    capability?: ILocalWalletCapability;
  }): Promise<void> {
    const settings = await getVaultSettings({ networkId });
    const limit = settings.localWallet?.maxEnabledAccounts;
    if (limit === undefined) {
      return;
    }
    const resolved =
      capability ?? (await this.requireAccountCapability(networkId));
    const { accounts } = await resolved.listAccounts();
    const enabledKeys = new Set(
      accounts
        .filter((account) => account.slotEnabled ?? account.syncEnabled)
        .map((account) => account.accountRuntimeKey),
    );
    // A never-enabled account has no runtime identity yet, so it falls
    // through to the ceiling check -- enabling it does add a key.
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

  // Everything the sync settings page shows about a network: data footprint
  // and sync source. A chain that can't answer omits the row, not a false zero.
  @backgroundMethod()
  async getLocalWalletNetworkInfo({
    networkId,
  }: {
    networkId: string;
  }): Promise<{
    storageBytes: number | null | undefined;
    endpointUrl: string | undefined;
    endpointDefaultUrl: string | undefined;
    endpointIsCustom: boolean;
    endpointHealth:
      | { ok: boolean; latencyMs: number | null; atMs: number }
      | undefined;
  }> {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const capability = requireLocalWalletCapability(vault);
    const [storage, endpoint] = await Promise.all([
      // Unreadable is shown as unknown, not hidden: a database that cannot be
      // read is exactly when the reset button is needed.
      capability.getStorageUsage?.().catch((e) => {
        console.error('[privacy-chain] storage usage unavailable', {
          networkId,
          error: e instanceof Error ? e.message : String(e),
        });
        return { bytes: null };
      }),
      capability.getSyncEndpoint?.().catch(() => undefined),
    ]);
    return {
      storageBytes: storage?.bytes,
      endpointUrl: endpoint?.url,
      endpointDefaultUrl: endpoint?.defaultUrl,
      endpointIsCustom: !!endpoint && endpoint.url !== endpoint.defaultUrl,
      // Only meaningful while it describes the node now in use: after a switch
      // the last sample still belongs to the previous one.
      endpointHealth:
        endpoint?.health && endpoint.health.ok !== undefined
          ? endpoint.health
          : undefined,
    };
  }

  // The same count enforced by assertEnabledAccountLimit, shaped for a page.
  @backgroundMethod()
  async getLocalWalletSlotUsage({
    networkId,
  }: {
    networkId: string;
  }): Promise<ILocalWalletSlotUsage> {
    const settings = await getVaultSettings({ networkId });
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const capability = requireLocalWalletCapability(vault);
    const [{ accounts }, visibleAccounts] = await Promise.all([
      capability.listAccounts(),
      this.listLocalWalletAccounts(),
    ]);
    const visible = new Map(
      visibleAccounts.map((account) => [account.accountId, account]),
    );
    type IOccupant = ILocalWalletSlotUsage['occupants'][number];
    // Null marks an identity held only by wallets this session cannot see.
    const byIdentity = new Map<string, IOccupant | null>();
    for (const account of accounts) {
      if (!(account.slotEnabled ?? account.syncEnabled)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const item = visible.get(account.accountId);
      if (!item) {
        if (!byIdentity.has(account.accountRuntimeKey)) {
          byIdentity.set(account.accountRuntimeKey, null);
        }
        // eslint-disable-next-line no-continue
        continue;
      }
      const occupant = byIdentity.get(account.accountRuntimeKey);
      if (occupant) {
        occupant.aliasCount += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      byIdentity.set(account.accountRuntimeKey, {
        accountId: item.accountId,
        accountName: item.accountName,
        walletName: item.walletName,
        aliasCount: 1,
      });
    }
    const occupants = Array.from(byIdentity.values()).filter(
      (occupant): occupant is IOccupant => occupant !== null,
    );
    return {
      used: byIdentity.size,
      max: settings.localWallet?.maxEnabledAccounts,
      occupants,
      hiddenCount: byIdentity.size - occupants.length,
    };
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

  // Developer diagnostics only: setup metadata can include a viewing key, so it
  // must not be reachable through an ordinary background method.
  @backgroundMethodForDev()
  async getLocalWalletAccountMetaForDebug({
    networkId,
    accountId,
  }: {
    $$devOnlyPassword: string;
    networkId: string;
    accountId: string;
  }): Promise<unknown> {
    if (!platformEnv.isDev) {
      throw new OneKeyLocalError(
        'Privacy chain diagnostics are only available in development',
      );
    }
    const capability = await this.requireAccountCapability(networkId);
    return capability.getDebugAccountMeta?.({ accountId });
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
    // Paused accounts still hold address material, but handing it out would
    // let a payment land in a pool nothing is scanning -- gate on scan state.
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
    await this.forgetCachedLocalWalletBalance({ networkId, accountId });
    const settings = await getVaultSettings({ networkId });
    if (settings.localWallet?.viewingKeyRetention === 'with-local-data') {
      await removeLocalWalletViewingKeys({
        backgroundApi: this.backgroundApi,
        accountIds: [accountId],
      });
    }
  }

  // The shared token and account-value caches hold the composed balance,
  // private part included; deleting local privacy data must not leave it for
  // the next cold start to show.
  private async forgetCachedLocalWalletBalance({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    await removeLastLocalWalletBalances({
      backgroundApi: this.backgroundApi,
      accountIds: [accountId],
    });
    try {
      const account = await this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const owner = {
        networkId,
        accountAddress: account.address,
        xpub: 'xpub' in account ? account.xpub : undefined,
      };
      await this.backgroundApi.simpleDb.localTokens.removeAccountTokenList(
        owner,
      );
      await this.backgroundApi.simpleDb.accountValue.removeAccountNetworkValue(
        owner,
      );
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
    } catch (e) {
      console.error('[privacy-chain] could not forget cached balance', {
        networkId,
        ...describePrivacyChainError(e),
      });
    }
  }

  // HD accounts on any local-wallet network, optionally within one wallet.
  // Settings pages and wallet menus list from here, not from a chain impl.
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
    // Derive type label and display rank by template, only for networks with
    // more than one. Rank follows the derive type order (default first).
    const deriveLabelByNetwork = new Map<string, Map<string, string>>();
    const deriveRankByNetwork = new Map<string, Map<string, number>>();
    for (const networkId of networkIds) {
      // eslint-disable-next-line no-await-in-loop
      const items = await this.backgroundApi.serviceNetwork
        .getDeriveInfoItemsOfNetwork({ networkId })
        .catch(() => []);
      if (items.length > 1) {
        deriveLabelByNetwork.set(
          networkId,
          new Map(items.map((item) => [item.item.template, item.label])),
        );
        deriveRankByNetwork.set(
          networkId,
          new Map(items.map((item, rank) => [item.item.template, rank])),
        );
      }
    }
    const tempWalletIds = new Set(
      wallets.flatMap((w) => (w.isTemp ? [w.id] : [])),
    );
    const items: (ILocalWalletAccountListItem & {
      deriveRank: number;
      accountIndex: number;
    })[] = [];
    accounts.forEach((account) => {
      const accountWalletId = accountUtils.getWalletIdFromAccountId({
        accountId: account.id,
      });
      const networkId =
        account.createAtNetwork ?? networkIdByImpl.get(account.impl);
      const isCandidate =
        !!networkId &&
        networkIds.includes(networkId) &&
        // Same set the enable path asserts on: HD or hardware, never an
        // imported key or a watching account.
        (accountUtils.isHdAccount({ accountId: account.id }) ||
          accountUtils.isHwAccount({ accountId: account.id })) &&
        walletNames.has(accountWalletId) &&
        (!walletId || accountWalletId === walletId);
      if (isCandidate) {
        items.push({
          accountId: account.id,
          accountName: account.name,
          walletId: accountWalletId,
          walletName: walletNames.get(accountWalletId) ?? '',
          networkId,
          walletIsTemp: tempWalletIds.has(accountWalletId),
          deriveLabel: account.template
            ? deriveLabelByNetwork.get(networkId)?.get(account.template)
            : undefined,
          deriveRank:
            (account.template &&
              deriveRankByNetwork.get(networkId)?.get(account.template)) ||
            0,
          accountIndex: account.indexedAccountId
            ? accountUtils.parseIndexedAccountId({
                indexedAccountId: account.indexedAccountId,
              }).index
            : Number.MAX_SAFE_INTEGER,
        });
      }
    });
    // Group accounts of one derive type together (#1, #2, #3, then the next
    // type) rather than interleaving by index.
    const firstSeen = (keys: string[]) => {
      const order = new Map<string, number>();
      keys.forEach((key) => {
        if (!order.has(key)) order.set(key, order.size);
      });
      return order;
    };
    const walletOrder = firstSeen(items.map((item) => item.walletId));
    const networkOrder = firstSeen(items.map((item) => item.networkId));
    return items
      .toSorted(
        (a, b) =>
          (walletOrder.get(a.walletId) ?? 0) -
            (walletOrder.get(b.walletId) ?? 0) ||
          (networkOrder.get(a.networkId) ?? 0) -
            (networkOrder.get(b.networkId) ?? 0) ||
          a.deriveRank - b.deriveRank ||
          a.accountIndex - b.accountIndex,
      )
      .map(({ deriveRank: _rank, accountIndex: _index, ...item }) => item);
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

  // Optional public-parameter setup while the user composes a payment.
  @backgroundMethod()
  async prewarmLocalWalletSend({
    networkId,
    ...params
  }: {
    networkId: string;
    accountId: string;
    sourcePool: string;
    toAddress: string;
  }): Promise<void> {
    const settings = await getVaultSettings({ networkId });
    if (!settings.localWallet) return;
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    await vault.getLocalWalletCapability()?.prewarmSend?.(params);
  }

  // What a privacy-chain transaction pays, from the chain's strict parse.
  // Amounts are base units; `decimals` converts them for display.
  async reviewLocalWalletTransaction({
    networkId,
    encodedTx,
  }: {
    networkId: string;
    encodedTx: unknown;
  }): Promise<ILocalWalletReviewedTransaction & { decimals: number }> {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const reviewed =
      requireLocalWalletCapability(vault).reviewTransaction(encodedTx);
    const { decimals } = await vault.getNetwork();
    return { ...reviewed, decimals };
  }

  // For the send page: how far this account's scan still has to go, and
  // whether that blocks sending. Undefined if the chain doesn't gate sends on sync.
  @backgroundMethod()
  async getLocalWalletSendReadiness({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<{ blocksLeft: number | null; canSend: boolean } | undefined> {
    const settings = await getVaultSettings({ networkId });
    if (!settings.localWallet) return undefined;
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const sendMaxBlocksLeft =
      vault.getLocalWalletCapability()?.syncPolicy.sendMaxBlocksLeft;
    if (sendMaxBlocksLeft === undefined) return undefined;
    const progress = await this.getLocalWalletSyncProgress({
      networkId,
      accountId,
    }).catch(() => undefined);
    if (!progress) return undefined;
    const blocksLeft = getPrivacyChainBlocksLeft(progress);
    return {
      blocksLeft,
      canSend: blocksLeft !== null && blocksLeft < sendMaxBlocksLeft,
    };
  }

  @backgroundMethod()
  async getLocalWalletSyncProgress({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<ILocalWalletSyncProgress | undefined> {
    // Reading progress never starts a boost session -- only explicit triggers
    // do. Returns the last published value first: a live read shares a FIFO
    // lane with the scan and would queue behind a pass.
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

  // Progress for a chain held back by metered data. No network call: reads
  // the runtime's own status so the light has something to render for consent.
  async publishHeldScanProgress(): Promise<void> {
    try {
      for (const networkId of await this.getLocalWalletNetworkIds()) {
        const vault = await vaultFactory.getChainOnlyVault({ networkId });
        const capability = requireLocalWalletCapability(vault);
        const { accounts } = await capability.listAccounts();
        const enabled = accounts.filter(({ syncEnabled }) => syncEnabled);
        if (enabled.length === 0) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const entries = await Promise.all(
          enabled.map(async ({ accountId }) => {
            const progress = await capability
              .getSyncProgress({ accountId })
              .catch(() => undefined);
            return [`${networkId}:${accountId}`, progress] as const;
          }),
        );
        await privacyChainAtom.set((v) => {
          const progress = { ...v.progress };
          for (const [key, value] of entries) {
            if (value) {
              progress[key] = value;
            }
          }
          return { ...v, progress };
        });
        // Marks the network as wanting to run, turning the light into its "held
        // on mobile data" state (only networks with work left).
        const hasWorkLeft = entries.some(
          ([, progress]) =>
            !!progress &&
            (!progress.isTipCaughtUp || !progress.isBackfillComplete),
        );
        if (hasWorkLeft) {
          this.foregroundBoostRequestedByNetwork[networkId] = true;
        }
      }
      await this.publishBoostingNetworks();
    } catch (e) {
      console.error('[privacy-chain] held progress publish failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Publishes this group's progress to the atom every reader subscribes to,
  // right after the pass that produced the new state.
  async publishScanProgress(candidate: IPrivacyChainSyncCandidate) {
    await this.publishAccountsScanProgress({
      networkId: candidate.networkId,
      accountIds: candidate.accountIds,
      capability: candidate.capability,
    });
  }

  /**
   * Same publish, callable by a chain mid-turn. Step-based chains (Monero)
   * call it per step; self-bounding chains (Zcash) rely on the per-pass
   * publish above. Not a background method -- reached in-process.
   */
  async publishLocalWalletSyncProgress({
    networkId,
    accountIds,
  }: {
    networkId: string;
    accountIds: string[];
  }): Promise<void> {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    // Called per scan step with the one account being scanned: the other
    // accounts on this network are still live and keep their published rows.
    await this.publishAccountsScanProgress({
      networkId,
      accountIds,
      capability: requireLocalWalletCapability(vault),
      pruneOthers: false,
    });
  }

  // `pruneOthers`: `accountIds` is the network's whole live set, so rows for
  // any other account on it are stale and dropped.
  private async publishAccountsScanProgress({
    networkId,
    accountIds,
    capability,
    pruneOthers = true,
  }: {
    networkId: string;
    accountIds: string[];
    capability: ILocalWalletCapability;
    pruneOthers?: boolean;
  }) {
    try {
      const entries = await Promise.all(
        accountIds.map(async (accountId) => {
          const progress = await capability.getSyncProgress({ accountId });
          return [`${networkId}:${accountId}`, progress] as const;
        }),
      );
      await privacyChainAtom.set((v) => {
        const progress = { ...v.progress };
        const liveKeys = new Set(
          accountIds.map((accountId) => `${networkId}:${accountId}`),
        );
        for (const key of Object.keys(progress)) {
          if (
            pruneOthers &&
            key.startsWith(`${networkId}:`) &&
            !liveKeys.has(key)
          ) {
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
        networkId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Two published lists: a wanted-but-refused boost is actionable (offers
  // the consent toggle) while a paused one is not; neither implies the other.
  async publishBoostingNetworks() {
    const requested = Object.keys(this.foregroundBoostRequestedByNetwork);
    const boostingNetworkIds = requested.filter((id) =>
      this.isNetworkForegroundHot(id),
    );
    // All paused networks, regardless of whether a boost was ever requested:
    // pausing must stay visible even after that request clears.
    const pausedNetworkIds = Object.keys(this.boostPausedByNetwork).filter(
      (id) => !!this.boostPausedByNetwork[id],
    );
    // A paused network is never also waiting for data consent.
    const dataBlockedNetworkIds = requested.filter(
      (id) =>
        !this.boostPausedByNetwork[id] && this.isNetworkBoostBlockedByData(id),
    );
    await privacyChainAtom.set((v) => ({
      ...v,
      boostingNetworkIds,
      dataBlockedNetworkIds,
      pausedNetworkIds,
    }));
  }

  // Foreground pace derived from the just-published position. Deliberately
  // skips the metered-data check: a boost refused by gate two must stay
  // REQUESTED, or the consent prompt never reaches the user.
  async refreshAutoBoost(
    candidate: Pick<
      IPrivacyChainSyncCandidate,
      'networkId' | 'accountIds' | 'capability'
    >,
  ): Promise<void> {
    const { networkId } = candidate;
    // The account furthest behind decides: the light means "not usable yet",
    // and one account that cannot send yet is enough to say so.
    let mostRemaining: number | null = null;
    for (const accountId of candidate.accountIds) {
      // eslint-disable-next-line no-await-in-loop
      const remaining = await this.getPublishedRemainingBlocks({
        networkId,
        accountId,
      });
      if (remaining !== null) {
        mostRemaining = Math.max(mostRemaining ?? 0, remaining);
      }
    }
    const wasRequested = !!this.foregroundBoostRequestedByNetwork[networkId];
    const wanted = shouldStartBoost({
      trigger: 'auto-backfill',
      networkId,
      remainingBlocks: mostRemaining,
      pausedByUser: this.boostPausedByNetwork[networkId],
    });
    // While paused `wanted` is false, and dropping the request here would
    // erase the paused light on the next pass.
    if (this.boostPausedByNetwork[networkId]) {
      return;
    }
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
      remainingBlocks: mostRemaining,
    });
    await this.publishBoostingNetworks();
  }

  // One-time "where to start scanning" prompt flag lives in the shared
  // privacy-chain store; only the chain-shaped answer stays with the chain.
  // Debug door: per-read timing, for console use while reproducing a slow
  // read. Not wired to any UI.
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

  // Viewing-level repair; no keyring/password needed, so a chain-only vault
  // suffices.
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
