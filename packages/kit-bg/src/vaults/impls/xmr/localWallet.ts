import {
  hasXmrRuntimeApiLoader,
  readXmrRuntimeError,
} from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { parseXmrTransaction } from '@onekeyhq/core/src/chains/xmr/transactionReview';
import {
  XMR_BUILT_IN_NODE_URLS,
  XMR_DECIMALS,
  XMR_SEND_MAX_BLOCKS_LEFT,
  XMR_SYNC_EXPECTED_STEP_MS,
  XMR_SYNC_STEP_BLOCKS,
  XMR_SYNC_TURN_BUDGET_MS,
  XMR_SYNC_WATCHDOG_MS,
  XMR_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { privacyChainPerfLog } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

import {
  LOCAL_WALLET_DISPLAY_WAIT_MS,
  readLocalWalletBalanceStaleFirst,
  saveLastLocalWalletBalance,
  saveLastLocalWalletChainTip,
} from '../../localWallet/privacyChainCacheStore';
import { runBoundedSyncTurn } from '../../localWallet/syncTurn';

import {
  estimateXmrBirthdayHeight,
  estimateXmrHeightDaysAgo,
} from './birthday';
import { KeyringHd } from './KeyringHd';
import {
  deleteXmrDatabase,
  forgetXmrStaleFirstAccount,
  getXmrChainTip,
  getXmrIdentityId,
  getXmrLastKnownChainTip,
  getXmrLocalRuntime,
  getXmrNodeHealth,
  getXmrRuntime,
  isXmrRuntimeBusy,
  readXmrStaleFirst,
} from './runtime';

import type Vault from './Vault';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountBalance,
  ILocalWalletAccountState,
  ILocalWalletCapability,
  ILocalWalletFrozenPart,
  ILocalWalletFrozenReason,
  ILocalWalletSyncPolicy,
  ILocalWalletSyncProgress,
} from '../../localWallet/types';

/**
 * Monero has no public pool, so publicAddress and privateAddress are the
 * same string. A watch-only wallet can't detect its own spends without the
 * spend key, so unverified balance is reported as frozen, not total.
 */

const XMR_PROCESS_STARTED_AT = Date.now();

const ATOMIC_PER_XMR = 10n ** BigInt(XMR_DECIMALS);

function toParsed(atomic: string | undefined): string | undefined {
  if (atomic === undefined) return undefined;
  let value: bigint;
  try {
    value = BigInt(atomic);
  } catch {
    return undefined;
  }
  const whole = value / ATOMIC_PER_XMR;
  const frac = (value % ATOMIC_PER_XMR).toString().padStart(XMR_DECIMALS, '0');
  return `${whole.toString()}.${frac}`.replace(/\.?0+$/, '') || '0';
}

// networkId:accountId of pages turned away mid-step. Module-level: the page
// and the scan may hold different capability objects.
const xmrBalanceWanted = new Set<string>();

export function buildXmrLocalWalletCapability(
  vault: Vault,
): ILocalWalletCapability {
  const simpleDb = () => vault.backgroundApi.simpleDb.xmr;

  // Runtime here already has its DB open and node configured (see runtime.ts).
  const requireRuntime = () => getXmrRuntime(vault);

  const accountRuntimeId = async (accountId: string): Promise<string> =>
    getXmrIdentityId({ api: await getXmrLocalRuntime(vault), accountId });

  // Re-registers an account the runtime lost (rebuilt DB or failed resync)
  // from its saved birthday; the stored view key needs no password.
  const ensureRegistered = async (accountId: string): Promise<string> => {
    try {
      return await accountRuntimeId(accountId);
    } catch (error) {
      const state = await simpleDb().getAccountState({ accountId });
      if (state.intent !== 'on' || state.birthdayHeight === undefined) {
        throw error;
      }
      const keys = await vault.getXmrViewingKeys({ accountId });
      const api = await getXmrLocalRuntime(vault);
      await api.addAccount(
        accountId,
        keys.spendPublicKeyHex,
        keys.viewPrivateKeyHex,
        String(state.birthdayHeight),
      );
      return accountRuntimeId(accountId);
    }
  };

  const removeAccountData = async (
    accountId: string,
    { keepBirthday = false }: { keepBirthday?: boolean } = {},
  ): Promise<void> => {
    if (hasXmrRuntimeApiLoader()) {
      const api = await getXmrLocalRuntime(vault);
      await api.removeAccount(accountId);
    }
    forgetXmrStaleFirstAccount(accountId);
    await simpleDb().removeAccount({ accountId, keepBirthday });
  };

  const rewindLocalAccount = async (accountId: string, fromHeight: number) => {
    const api = await getXmrLocalRuntime(vault);
    const runtimeId = await getXmrIdentityId({ api, accountId });
    const peek = JSON.parse(await api.syncPeek(runtimeId)) as {
      scannedToHeight: number | null;
      ranges: { start: number; end: number }[];
    };
    const observedTip = Math.max(
      (await getXmrLastKnownChainTip(vault)) ?? 0,
      peek.scannedToHeight ?? 0,
      ...peek.ranges.map((range) => range.end - 1),
    );
    await api.rewindTo(
      runtimeId,
      String(Math.max(fromHeight - 1, 0)),
      String(observedTip),
    );
    forgetXmrStaleFirstAccount(accountId);
  };

  const readBalance = async (
    accountId: string,
  ): Promise<ILocalWalletAccountBalance | null> => {
    const api = await getXmrLocalRuntime(vault);
    const runtimeId = await getXmrIdentityId({ api, accountId });
    // Without a tip (never fetched), nothing can be marked unlocked.
    const tip = await getXmrLastKnownChainTip(vault).catch(() => undefined);
    const raw = JSON.parse(
      await api.balance(runtimeId, tip === undefined ? undefined : String(tip)),
    ) as {
      totalAtomic: string;
      unlockedAtomic: string;
      unverifiableAtomic: string;
      pendingChangeAtomic: string;
    };
    // Remaining locked amount is the 10-block maturation lock; without a
    // tip it can't be called confirming.
    const unverifiable = BigInt(raw.unverifiableAtomic);
    const pendingSend = BigInt(raw.pendingChangeAtomic);
    const confirming =
      BigInt(raw.totalAtomic) -
      BigInt(raw.unlockedAtomic) -
      unverifiable -
      pendingSend;
    const frozen: ILocalWalletFrozenPart[] = [];
    const addFrozen = (reason: ILocalWalletFrozenReason, amount: bigint) => {
      if (amount > 0n) {
        frozen.push({
          reason,
          amountParsed: toParsed(amount.toString()) ?? '0',
        });
      }
    };
    addFrozen('needsPassword', unverifiable);
    addFrozen('pendingSend', pendingSend);
    if (tip !== undefined) addFrozen('confirming', confirming);

    return {
      total: raw.totalAtomic,
      totalParsed: toParsed(raw.totalAtomic),
      spendable: raw.unlockedAtomic,
      pools: [
        {
          key: 'private',
          total: raw.totalAtomic,
          totalParsed: toParsed(raw.totalAtomic),
          spendable: raw.unlockedAtomic,
          spendableParsed: toParsed(raw.unlockedAtomic),
          hints: [],
          frozen,
        },
      ],
      frozen,
    };
  };

  const readSyncProgress = async ({
    accountId,
    state,
  }: {
    accountId: string;
    state: Awaited<ReturnType<ReturnType<typeof simpleDb>['getAccountState']>>;
  }): Promise<ILocalWalletSyncProgress | undefined> => {
    const api = await getXmrLocalRuntime(vault);
    const runtimeId = await getXmrIdentityId({ api, accountId }).catch(
      () => null,
    );
    if (runtimeId === null) return undefined;
    const peek = JSON.parse(await api.syncPeek(runtimeId)) as {
      scannedToHeight: number | null;
      ranges: { start: number; end: number }[];
      birthdayHeight?: number;
    };
    const chainTip =
      (await getXmrLastKnownChainTip(vault).catch(() => undefined)) ?? null;

    // Prefer the runtime's birthday; re-enabling rewrites the stored value.
    const birthday = peek.birthdayHeight ?? state.birthdayHeight ?? null;
    const scanned = peek.scannedToHeight;
    const remaining = peek.ranges.reduce(
      (sum, range) => sum + (range.end - range.start),
      0,
    );
    // Falls back to the first queued range so progress shows 0%, not blank,
    // before any scanning happens.
    const backfillFrom = scanned ?? peek.ranges[0]?.start ?? null;
    const tipLag =
      chainTip !== null && scanned !== null ? chainTip - scanned : null;

    return {
      birthdayHeight: birthday,
      backfillScannedHeight: backfillFrom,
      backfillTargetHeight: chainTip,
      backfillProgress:
        birthday !== null && chainTip !== null && backfillFrom !== null
          ? Math.min(
              1,
              Math.max(
                0,
                (backfillFrom - birthday) / Math.max(1, chainTip - birthday),
              ),
            )
          : null,
      isBackfillComplete: remaining === 0,
      tipScannedHeight: scanned,
      chainTip,
      tipLag,
      isTipCaughtUp:
        tipLag !== null &&
        tipLag * XMR_TARGET_BLOCK_SECONDS <= XMR_TARGET_BLOCK_SECONDS * 2,
      isSyncing: remaining > 0,
    };
  };

  // A page turned away by a busy runtime asks the scan to save a balance
  // after its current step; nobody asking, no work.
  const saveScannedBalance = async (accountId: string) => {
    try {
      const value = await readBalance(accountId);
      if (value) {
        await saveLastLocalWalletBalance({
          backgroundApi: vault.backgroundApi,
          networkId: vault.networkId,
          accountId,
          value,
        });
      }
    } catch (error) {
      console.warn('[xmr] could not save the scanned balance', { error });
    }
  };

  const notifyAccountsChanged = async (params: {
    accountId: string;
    backfillActive: boolean;
  }) => {
    try {
      await vault.backgroundApi.servicePrivacyChain.onLocalWalletAccountsChanged(
        {
          networkId: vault.networkId,
          accountIds: [params.accountId],
          backfillActive: params.backfillActive,
        },
      );
    } catch (error) {
      console.error('[xmr] accounts-changed notification failed', error);
    }
  };

  const syncPolicy: ILocalWalletSyncPolicy = {
    // Watchdog is sized to the shared/config/xmr.ts step numbers.
    maxSyncDurationMs: XMR_SYNC_WATCHDOG_MS,
    turn: {
      stepBlocks: XMR_SYNC_STEP_BLOCKS,
      expectedStepMs: XMR_SYNC_EXPECTED_STEP_MS,
      budgetMs: XMR_SYNC_TURN_BUDGET_MS,
    },
    foregroundBackfillDelayMs: 250,
    backgroundBackfillDelayMs: { desktop: 1500, default: 5000 },
    sendMaxBlocksLeft: XMR_SEND_MAX_BLOCKS_LEFT,
  };

  return {
    reviewTransaction(encodedTx) {
      const tx = parseXmrTransaction(encodedTx);
      return {
        encodedTx: tx,
        to: tx.to,
        amount: tx.amountAtomic,
        fee: tx.feeAtomic,
      };
    },
    async getAccountState({ accountId }): Promise<ILocalWalletAccountState> {
      const state = await simpleDb().getAccountState({ accountId });
      return {
        enabled: state.intent === 'on' && !state.operation,
        // Paused = opted out with a resume position still on disk.
        paused: state.intent === 'off' && state.resumeFromHeight !== undefined,
        pendingOperation: state.operation?.type,
        birthdayHeight: state.birthdayHeight,
        birthdaySource: state.birthdaySource,
        birthdayTimestamp: state.birthdayTimestamp,
      };
    },

    async enableAccount({ accountId, birthdayHeight, birthdayTimestamp }) {
      const api = await requireRuntime();
      const chainTip = await getXmrChainTip(api);
      const previous = await simpleDb().getAccountState({ accountId });
      // The enable dialog collects a month, never a height.
      let height = birthdayHeight;
      if (height === undefined && birthdayTimestamp !== undefined) {
        height = estimateXmrBirthdayHeight({
          birthdayTimestamp,
          now: Date.now(),
          chainTip,
        });
      }
      const chosen = height !== undefined;
      // Resume keeps its original start so a lost scan still covers old
      // funds; a fresh enable starts at tip (zero would scan from genesis).
      height ??= previous.birthdayHeight ?? chainTip;

      // Journal intent first so resumePendingOperations() can finish a crash.
      await simpleDb().beginEnable({
        accountId,
        birthdayHeight: height,
        birthdayTimestamp,
      });

      const account = await vault.getXmrViewingKeys({ accountId });
      const added = JSON.parse(
        await api.addAccount(
          accountId,
          account.spendPublicKeyHex,
          account.viewPrivateKeyHex,
          String(height),
        ),
      ) as { birthdayHeight?: number };

      // Sub-addresses need no registration: the runtime keeps a lookahead
      // window past the highest one that has received funds.
      const runtimeId = await accountRuntimeId(accountId);
      // Runtime only queues the birthday..tip scan range once it learns the
      // tip; addAccount alone queues nothing.
      await api.updateChainTip(runtimeId, String(chainTip));

      // An earlier start rewinds: later blocks were scanned without the older
      // outputs, so their spends were never checked.
      let runtimeBirthday = added.birthdayHeight;
      if (chosen && runtimeBirthday !== undefined && height < runtimeBirthday) {
        await api.rewindTo(
          runtimeId,
          String(Math.max(height - 1, 0)),
          String(chainTip),
        );
        runtimeBirthday = height;
      }

      // Store the runtime's value: rescan-from-birthday reads it.
      await simpleDb().completeEnable({
        accountId,
        birthdayHeight: runtimeBirthday,
      });

      // Already enabled; a failed notification must not look like a failed enable.
      await notifyAccountsChanged({ accountId, backfillActive: true });
    },

    async disableAccount({ accountId }) {
      // Record the resume position first; losing it means a full rescan.
      const progress = await this.getSyncProgress({ accountId });
      const state = await simpleDb().getAccountState({ accountId });
      await simpleDb().beginDisable({
        accountId,
        resumeFromHeight:
          progress?.tipScannedHeight ?? state.birthdayHeight ?? 0,
      });
      await simpleDb().completeDisable({ accountId });
      await notifyAccountsChanged({ accountId, backfillActive: false });
    },

    async retryAccountSetup({ accountId }) {
      const state = await simpleDb().getAccountState({ accountId });
      if (state.operation?.type === 'enable') {
        await this.enableAccount({
          accountId,
          birthdayHeight: state.birthdayHeight,
        });
        return;
      }
      if (state.operation?.type === 'disable') {
        await simpleDb().completeDisable({ accountId });
      }
    },

    async getAccountAddresses({
      accountId,
    }): Promise<ILocalWalletAccountAddresses | undefined> {
      // The primary address is on the account record; no view key needed.
      const account = await vault.backgroundApi.serviceAccount
        .getAccount({ accountId, networkId: vault.networkId })
        .catch(() => undefined);
      if (!account?.address) return undefined;
      const state = await simpleDb().getAccountState({ accountId });
      const enabled = state.intent === 'on' && !state.operation;
      return {
        publicAddress: account.address,
        // Exposed as private only while scanning, or we'd promise visibility
        // we don't have.
        privateAddress: enabled ? account.address : undefined,
      };
    },

    async deriveViewingKey({ accountId, password }) {
      if (
        vault.accountId !== accountId ||
        !(vault.keyring instanceof KeyringHd)
      ) {
        throw new OneKeyLocalError(
          'xmr: viewing key derivation needs this HD account',
        );
      }
      return vault.keyring.xmrDeriveViewingKey({ password });
    },

    async deleteAccountData({ accountId }) {
      // As on Zcash: re-enabling reuses the birthday instead of starting at tip.
      await removeAccountData(accountId, { keepBirthday: true });
    },

    async getAccountBalance({
      accountId,
    }): Promise<ILocalWalletAccountBalance | null> {
      const state = await simpleDb().getAccountState({ accountId });
      // A paused account keeps its scanned data; its last balance is real,
      // just not advancing.
      const paused =
        state.intent === 'off' && state.resumeFromHeight !== undefined;
      if ((state.intent !== 'on' && !paused) || state.operation) return null;
      if (!hasXmrRuntimeApiLoader()) return null;

      // UI read: the saved balance while a scan step holds the runtime or
      // the node is slow to answer, never queued behind either.
      const busy = isXmrRuntimeBusy();
      if (busy) xmrBalanceWanted.add(`${vault.networkId}:${accountId}`);
      const result = await readLocalWalletBalanceStaleFirst({
        backgroundApi: vault.backgroundApi,
        networkId: vault.networkId,
        accountId,
        liveWaitMs: LOCAL_WALLET_DISPLAY_WAIT_MS,
        skipLive: busy,
        read: () => readBalance(accountId),
      });
      if (!result) return null;
      return result.stale
        ? { ...result.value, balanceStatus: 'partial' }
        : result.value;
    },

    // One pool: the send flow shows no picker.
    listSendPools: undefined,

    syncPolicy,

    async listAccounts() {
      const enabled = await simpleDb().listEnabledAccountIds();
      return {
        accounts: enabled.map((accountId) => ({
          accountId,
          // One shared database per network.
          runtimeKey: 'xmr-mainnet',
          accountRuntimeKey: accountId,
          syncEnabled: true,
        })),
        // Lets GC drop accounts whose app account was deleted, including
        // their view key on disk.
        cleanupAccountIds: await simpleDb().listAccountIds(),
      };
    },

    async getAccountAliases({ accountId }) {
      // Monero has no derivation aliases: one account, one key pair.
      return [accountId];
    },

    async getChainTip() {
      if (!hasXmrRuntimeApiLoader()) return null;
      const tip = await getXmrChainTip(await requireRuntime());
      // Lets the next cold start show progress before the node answers.
      await saveLastLocalWalletChainTip({
        backgroundApi: vault.backgroundApi,
        networkId: vault.networkId,
        height: tip,
      });
      return tip;
    },

    async getSyncEndpoint() {
      const url = await vault.resolveXmrNodeUrl();
      const health = getXmrNodeHealth();
      return {
        url,
        defaultUrl: XMR_BUILT_IN_NODE_URLS[0],
        health:
          health?.url === url
            ? { ok: health.ok, latencyMs: health.latencyMs, atMs: health.atMs }
            : undefined,
      };
    },

    async onWalletCreated() {
      // Scanning is opt-in per account, never implied by a wallet existing.
    },

    async resumePendingOperations() {
      // Operations started in this process are still running.
      const pending = await simpleDb().listPendingOperations({
        startedBefore: XMR_PROCESS_STARTED_AT,
      });
      for (const item of pending) {
        // eslint-disable-next-line no-await-in-loop
        await this.retryAccountSetup({ accountId: item.accountId });
      }
    },

    async gcWalletState({ liveWalletIds }) {
      const enabled = await simpleDb().listEnabledAccountIds();
      for (const accountId of enabled) {
        // A prefix test would count hd-1 as alive while only hd-10 exists.
        const alive = liveWalletIds.includes(
          accountUtils.getWalletIdFromAccountId({ accountId }),
        );
        if (!alive) {
          // eslint-disable-next-line no-await-in-loop
          await removeAccountData(accountId);
        }
      }
    },

    async syncGroup({ accountIds, chainTip }) {
      if (!hasXmrRuntimeApiLoader() || accountIds.length === 0) {
        return { synced: false };
      }
      const api = await requireRuntime();
      const tip = chainTip ?? (await getXmrChainTip(api));
      const { turn } = syncPolicy;
      if (!turn) {
        throw new OneKeyLocalError('xmr: syncPolicy.turn is required');
      }

      let stateChanged = false;
      let backfillRemaining = false;

      for (const accountId of accountIds) {
        // eslint-disable-next-line no-await-in-loop
        const runtimeId = await ensureRegistered(accountId);
        // eslint-disable-next-line no-await-in-loop
        await api.updateChainTip(runtimeId, String(tip));
        // eslint-disable-next-line no-await-in-loop
        const result = await runBoundedSyncTurn({
          budgetMs: turn.budgetMs,
          expectedStepMs: turn.expectedStepMs,
          // Publish after every step; readers pick it up on their own clocks.
          onStep: () =>
            vault.backgroundApi.servicePrivacyChain.publishLocalWalletSyncProgress(
              { networkId: vault.networkId, accountIds: [accountId] },
            ),
          step: async () => {
            const stepStartedAt = Date.now();
            let raw: string;
            try {
              raw = await api.syncStep(runtimeId, String(turn.stepBlocks));
            } catch (error) {
              const runtimeError = readXmrRuntimeError(error);
              // Reorg: roll back to the runtime's safe height and rescan
              // forward, else every later step hits the same orphaned block.
              const rewindHeight =
                runtimeError?.code === 'REORG_DETECTED'
                  ? Number(runtimeError.params?.suggestedRewindHeight)
                  : NaN;
              if (Number.isSafeInteger(rewindHeight) && rewindHeight >= 0) {
                console.warn('[xmr] chain reorganised; re-scanning', {
                  atHeight: runtimeError?.params?.atHeight,
                  rewindHeight,
                });
                await api.rewindTo(
                  runtimeId,
                  String(rewindHeight),
                  String(tip),
                );
                return { done: false, stateChanged: true };
              }
              const plainMessage =
                error instanceof Error ? error.message : String(error);
              console.error('[xmr] step failed', {
                ms: Date.now() - stepStartedAt,
                code: runtimeError?.code,
                operation: runtimeError?.params?.operation,
                detail: runtimeError?.detail,
                error: runtimeError ? undefined : plainMessage,
              });
              throw error;
            }
            const progress = JSON.parse(raw) as {
              blocksScanned: number;
              done: boolean;
              outputsFound: number;
              spendsDetected?: number;
              sendsFailed?: number;
              sendsRestored?: number;
              msDownload?: number;
              msScan?: number;
              fetchedVia?: string;
              fetchNote?: string | null;
              prefetchHit?: boolean;
            };
            // msDownload is measured inside wasm, so it includes host-relay hops.
            privacyChainPerfLog('xmr step', {
              blocks: progress.blocksScanned,
              msDownload: progress.msDownload,
              msScan: progress.msScan,
              ms: Date.now() - stepStartedAt,
              outputsFound: progress.outputsFound,
              done: progress.done,
              fetchedVia: progress.fetchedVia,
              prefetchHit: progress.prefetchHit,
              fetchNote: progress.fetchNote ?? undefined,
            });
            if (xmrBalanceWanted.delete(`${vault.networkId}:${accountId}`)) {
              await saveScannedBalance(accountId);
            }
            return {
              done: progress.done,
              // A spend seen on chain or a send given up both move balance.
              stateChanged:
                progress.outputsFound > 0 ||
                (progress.spendsDetected ?? 0) > 0 ||
                (progress.sendsFailed ?? 0) > 0 ||
                (progress.sendsRestored ?? 0) > 0,
            };
          },
        });
        if (result.stateChanged) stateChanged = true;
        if (!result.done) backfillRemaining = true;
      }

      return { synced: true, stateChanged, chainTip: tip, backfillRemaining };
    },

    async reset({ accountId, scope }) {
      // 'all' is the cleanup of a deleted app account, which never waits.
      if (scope === 'all') {
        await removeAccountData(accountId);
        return;
      }
      // Cache-only: drop scanned data but keep the opt-in, then rescan from
      // birthday.
      const state = await simpleDb().getAccountState({ accountId });
      if (hasXmrRuntimeApiLoader() && state.birthdayHeight !== undefined) {
        await rewindLocalAccount(accountId, state.birthdayHeight);
      }
    },

    // Runtime calls are serialized in runtime.ts and the Rust runtime refuses
    // a second writer (WALLET_BUSY).
    syncCompletionIsAuthoritative: true,

    async recoverFromTimeout() {
      return false;
    },

    async getStorageUsage() {
      if (!hasXmrRuntimeApiLoader()) return { bytes: null };
      // Opening the runtime creates its database; measuring must not.
      if (!(await simpleDb().hasAnyAccountState())) return { bytes: 0 };
      // Logical SQLite size; mid-step reads show the last known figure.
      return readXmrStaleFirst({
        key: 'storage',
        fallback: { bytes: null },
        read: async () => {
          const api = await getXmrLocalRuntime(vault);
          const diag = JSON.parse(await api.diagDatabase()) as {
            logicalBytes?: number;
          };
          return { bytes: diag.logicalBytes ?? null };
        },
      });
    },

    // Deletes the DB without opening it (so an unopenable DB is still
    // recoverable), then re-registers each enabled account from its saved
    // birthday; no password needed since view keys are in viewingKeyStore.
    async resetStorage() {
      if (!hasXmrRuntimeApiLoader()) return;
      await deleteXmrDatabase(await vault.getXmrNetwork());
      // A failed registration keeps its enabled intent for retry.
      let firstError: Error | undefined;
      for (const accountId of await simpleDb().listEnabledAccountIds()) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await ensureRegistered(accountId);
        } catch (error) {
          firstError ??=
            error instanceof Error
              ? error
              : new OneKeyLocalError(String(error));
        }
      }
      if (firstError) {
        // The accumulator above contains only Error instances.
        // eslint-disable-next-line no-throw-literal
        throw firstError;
      }
    },

    // Runtime accounts are removed before their journal entry, so an empty
    // journal means there is nothing to delete.
    async hasLocalData() {
      return (await simpleDb().listAccountIds()).length > 0;
    },

    // App reset: deletes even with no account state left, since a
    // pre-existing or half-failed-reset database can still hold view keys.
    async dropLocalData() {
      if (hasXmrRuntimeApiLoader()) {
        await deleteXmrDatabase(await vault.getXmrNetwork());
      }
      await simpleDb().clearRawData();
    },

    async getSyncProgress({
      accountId,
    }): Promise<ILocalWalletSyncProgress | undefined> {
      if (!hasXmrRuntimeApiLoader()) return undefined;
      const state = await simpleDb().getAccountState({ accountId });
      if (state.intent !== 'on') return undefined;

      // Mid-step reads return the last known progress or a placeholder.
      return readXmrStaleFirst({
        key: `progress:${accountId}`,
        fallback: {
          birthdayHeight: state.birthdayHeight ?? null,
          backfillScannedHeight: null,
          backfillTargetHeight: null,
          backfillProgress: null,
          isBackfillComplete: false,
          tipScannedHeight: null,
          chainTip: null,
          tipLag: null,
          isTipCaughtUp: false,
          isSyncing: true,
        },
        read: () => readSyncProgress({ accountId, state }),
      });
    },

    async rescan({ accountId, from, dryRun }) {
      const tip = await getXmrLastKnownChainTip(vault);

      let fromHeight: number;
      if (from.type === 'height') {
        fromHeight = from.height;
      } else if (tip === undefined) {
        // With no observed tip, genesis is the only start guaranteed not to skip funds.
        fromHeight = 0;
      } else if (from.type === 'timestamp') {
        fromHeight = estimateXmrBirthdayHeight({
          birthdayTimestamp: from.timestamp,
          now: Date.now(),
          chainTip: tip,
        });
      } else {
        fromHeight = estimateXmrHeightDaysAgo({
          daysAgo: from.daysAgo,
          chainTip: tip,
        });
      }
      if (dryRun) return { fromHeight };

      if (hasXmrRuntimeApiLoader()) {
        await rewindLocalAccount(accountId, fromHeight);
        // Like the runtime, only ever move the stored birthday earlier: a later
        // one would drop the funds in between on rebuild.
        const current = await simpleDb().getAccountState({ accountId });
        const movesEarlier =
          current.birthdayHeight === undefined ||
          fromHeight < current.birthdayHeight;
        if (movesEarlier) {
          let birthdayTimestamp: number | undefined;
          if (from.type === 'timestamp') {
            birthdayTimestamp = from.timestamp;
          } else if (from.type === 'daysAgo') {
            birthdayTimestamp = Date.now() - from.daysAgo * 24 * 60 * 60 * 1000;
          }
          await simpleDb().setAccountState({
            accountId,
            state: {
              ...current,
              birthdayHeight: fromHeight,
              birthdayTimestamp,
            },
          });
        }
      }
      return { fromHeight };
    },
  };
}
