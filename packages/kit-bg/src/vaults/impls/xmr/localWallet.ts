import {
  hasXmrRuntimeApiLoader,
  readXmrRuntimeError,
} from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { parseXmrTransaction } from '@onekeyhq/core/src/chains/xmr/transactionReview';
import {
  XMR_DECIMALS,
  XMR_HISTORY_PAGE_SIZE,
  XMR_SEND_MAX_BLOCKS_LEFT,
  XMR_SYNC_EXPECTED_STEP_MS,
  XMR_SYNC_STEP_BLOCKS,
  XMR_SYNC_TURN_BUDGET_MS,
  XMR_SYNC_WATCHDOG_MS,
  XMR_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODE } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import { privacyChainPerfLog } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

import { localWalletText } from '../../localWallet/messages';
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
  getXmrChainTipForDisplay,
  getXmrIdentityId,
  getXmrLocalRuntime,
  getXmrRuntime,
  isXmrRuntimeBusy,
  readXmrStaleFirst,
} from './runtime';

import type { IXmrHistoryItem } from './types';
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

// networkId:accountId -> a page asked for the balance while a scan step held
// the runtime. Module-level: the page and the scan may hold different
// capability objects.
const xmrBalanceWanted = new Set<string>();

export function buildXmrLocalWalletCapability(
  vault: Vault,
): ILocalWalletCapability {
  const simpleDb = () => vault.backgroundApi.simpleDb.xmr;

  // Runtime here already has its DB open and node configured (see runtime.ts).
  const requireRuntime = () => getXmrRuntime(vault);

  const accountRuntimeId = async (accountId: string): Promise<string> =>
    getXmrIdentityId({ api: await requireRuntime(), accountId });

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
      const api = await requireRuntime();
      await api.addAccount(
        accountId,
        keys.spendPublicKeyHex,
        keys.viewPrivateKeyHex,
        String(state.birthdayHeight),
      );
      return accountRuntimeId(accountId);
    }
  };

  // Waits for the account's own unconfirmed sends before rewind/delete: dropping
  // one makes its inputs spendable again, risking a double pay. Unreadable DB doesn't block.
  const assertNoPendingSend = async (accountIds: string[]): Promise<void> => {
    if (!hasXmrRuntimeApiLoader()) return;
    for (const accountId of accountIds) {
      let pending = false;
      try {
        const api = await requireRuntime();
        const runtimeId = await accountRuntimeId(accountId);
        for (let offset = 0; ;) {
          const page = JSON.parse(
            await api.history(runtimeId, XMR_HISTORY_PAGE_SIZE, offset),
          ) as { items: IXmrHistoryItem[]; total: number };
          pending = page.items.some(
            (item) =>
              item.direction === 'out' && item.height === null && !item.failed,
          );
          offset += page.items.length;
          if (pending || page.items.length === 0 || offset >= page.total) {
            break;
          }
        }
      } catch (error) {
        console.warn('[xmr] pending sends unreadable; not blocking', {
          error,
        });
      }
      if (pending) {
        throw Object.assign(
          new OneKeyLocalError(
            localWalletText(ETranslations.privacy_error_pending_send__msg),
          ),
          {
            code: PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODE,
            params: { accountId },
          },
        );
      }
    }
  };

  const removeAccountData = async (
    accountId: string,
    { keepBirthday = false }: { keepBirthday?: boolean } = {},
  ): Promise<void> => {
    if (hasXmrRuntimeApiLoader()) {
      const api = await requireRuntime();
      await api.removeAccount(accountId);
    }
    forgetXmrStaleFirstAccount(accountId);
    await simpleDb().removeAccount({ accountId, keepBirthday });
  };

  const readBalance = async (
    accountId: string,
  ): Promise<ILocalWalletAccountBalance | null> => {
    const api = await getXmrLocalRuntime(vault);
    const runtimeId = await getXmrIdentityId({ api, accountId });
    // Without a tip (never fetched), nothing can be marked unlocked.
    const tip = await getXmrChainTipForDisplay(vault).catch(() => undefined);
    const raw = JSON.parse(
      await api.balance(runtimeId, tip === undefined ? undefined : String(tip)),
    ) as {
      totalAtomic: string;
      unlockedAtomic: string;
      unverifiableAtomic: string;
      lockedByReservationAtomic: string;
      pendingChangeAtomic: string;
    };
    // Remaining locked amount is the 10-block maturation lock; without a
    // tip it can't be called confirming.
    const unverifiable = BigInt(raw.unverifiableAtomic);
    const pendingSend =
      BigInt(raw.lockedByReservationAtomic) + BigInt(raw.pendingChangeAtomic);
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
      (await getXmrChainTipForDisplay(vault).catch(() => undefined)) ?? null;

    // Prefer the runtime's birthday: re-enabling keeps the runtime identity's
    // birthday but rewrites the stored value.
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
      // Measured in time, not blocks: a block count means different things
      // on different chains.
      isTipCaughtUp:
        tipLag !== null &&
        tipLag * XMR_TARGET_BLOCK_SECONDS <= XMR_TARGET_BLOCK_SECONDS * 2,
      isSyncing: remaining > 0,
    };
  };

  // A scan turn holds the runtime for most of its budget, so a page's balance
  // read almost never lands in between. A page that was turned away asks the
  // scan to save one after its current step; nobody asking, no work.
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

  // Lets the scheduler/UI react immediately instead of waiting for their
  // next pass/focus.
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
    // Turn is composed from shared/config/xmr.ts step numbers; watchdog is
    // sized to match.
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
      // Needed on every path below: converting a month to height, defaulting
      // the birthday, and queuing the first scan range.
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

      // Journal intent before doing work: a crash here is resumed by
      // resumePendingOperations(), else the account would claim 'off' with a
      // database that already exists.
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

      // If the chosen start predates the existing birthday, rewind: blocks
      // after the old birthday were scanned without the older outputs, so
      // spends of them were never checked.
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

      // Account is enabled and journal closed already; a failed notification
      // here must not look like a failed enable.
      await notifyAccountsChanged({ accountId, backfillActive: true });
    },

    async disableAccount({ accountId }) {
      await assertNoPendingSend([accountId]);
      // Record resume position before disabling; losing it means a full
      // rescan from birthday. Falls back to birthdayHeight if progress has
      // no height yet (mid-step placeholder).
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
        // Same address, exposed as private only while scanning: otherwise
        // we'd promise visibility we don't have.
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
      await assertNoPendingSend([accountId]);
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

    async onWalletCreated() {
      // Nothing to do: scanning is opted into per account, never implied by
      // a wallet existing.
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
          await assertNoPendingSend([accountId]);
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
              // Scheduler only logs a generic failure; this records which
              // stage broke and why.
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
              msDownload?: number;
              msScan?: number;
              fetchedVia?: string;
              fetchNote?: string | null;
              prefetchHit?: boolean;
            };
            // msDownload is measured inside wasm, so it includes every
            // host-relay hop; the node's own time is the host's 'node fetch' log.
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
                (progress.sendsFailed ?? 0) > 0,
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
      await assertNoPendingSend([accountId]);
      // Cache-only: drop scanned data but keep the opt-in, then rescan from
      // birthday.
      const state = await simpleDb().getAccountState({ accountId });
      if (hasXmrRuntimeApiLoader() && state.birthdayHeight !== undefined) {
        const api = await requireRuntime();
        const runtimeId = await accountRuntimeId(accountId);
        const tip = await getXmrChainTip(api);
        // Rewinding to H keeps block H; one below rescans it.
        await api.rewindTo(
          runtimeId,
          String(Math.max(state.birthdayHeight - 1, 0)),
          String(tip),
        );
        forgetXmrStaleFirstAccount(accountId);
      }
    },

    // Safe because every runtime call is serialized by the lock in
    // runtime.ts, and the Rust runtime refuses a second writer (WALLET_BUSY);
    // once an abandoned turn settles, nothing of it is still writing.
    syncCompletionIsAuthoritative: true,

    async recoverFromTimeout() {
      return false;
    },

    async getStorageUsage() {
      if (!hasXmrRuntimeApiLoader()) return { bytes: null };
      // Opening the runtime creates its database; measuring must not.
      if (!(await simpleDb().hasAnyAccountState())) return { bytes: 0 };
      // Logical SQLite size (pages x page size). UI read: shows last known
      // figure mid-step, or unknown before any.
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
    // birthday; no password needed since view keys live on the account record.
    async resetStorage() {
      if (!hasXmrRuntimeApiLoader()) return;
      await assertNoPendingSend(await simpleDb().listEnabledAccountIds());
      await deleteXmrDatabase(await vault.getXmrNetwork());
      // An account that fails to register now (node unreachable) stays
      // enabled; the next sync retries it.
      let firstError: Error | undefined;
      for (const accountId of await simpleDb().listEnabledAccountIds()) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.enableAccount({ accountId });
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
    // journal means there is nothing to delete. A half-failed reset is
    // retried through the service's pending-drop list.
    async hasLocalData() {
      return (await simpleDb().listAccountIds()).length > 0;
    },

    // App reset: deletes even with no account state left, since a
    // pre-existing or half-failed-reset database can still hold view keys.
    async dropLocalData() {
      const accountIds = await simpleDb().listAccountIds();
      if (hasXmrRuntimeApiLoader()) {
        await deleteXmrDatabase(await vault.getXmrNetwork());
      }
      await Promise.all(
        accountIds.map((accountId) =>
          vault.backgroundApi.simpleDb.privacyChain.removeScanStartPrompted({
            accountId,
          }),
        ),
      );
      await simpleDb().clearRawData();
    },

    async setDiagnosticsEnabled({ enabled }) {
      await simpleDb().setDiagnosticsEnabled(enabled);
    },

    async getSyncProgress({
      accountId,
    }): Promise<ILocalWalletSyncProgress | undefined> {
      if (!hasXmrRuntimeApiLoader()) return undefined;
      const state = await simpleDb().getAccountState({ accountId });
      if (state.intent !== 'on') return undefined;

      // UI read: returns the last known progress while a step is in flight,
      // or 'syncing, heights unknown' as an honest placeholder.
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
      const state = await simpleDb().getAccountState({ accountId });
      // Only an exact-height dry run can skip the live tip; every other path
      // needs it to convert a date or to rewind.
      const needsRuntime = !(dryRun && from.type === 'height');
      const api =
        needsRuntime && hasXmrRuntimeApiLoader()
          ? await requireRuntime()
          : undefined;
      const tip = api ? await getXmrChainTip(api) : undefined;

      let fromHeight: number;
      if (from.type === 'height') {
        fromHeight = from.height;
      } else if (tip === undefined) {
        // A date needs the tip to become a height; with no runtime to ask,
        // fall back to the stored birthday.
        fromHeight = state.birthdayHeight ?? 0;
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
      await assertNoPendingSend([accountId]);

      if (api && tip !== undefined) {
        const runtimeId = await accountRuntimeId(accountId);
        await api.rewindTo(
          runtimeId,
          String(Math.max(fromHeight - 1, 0)),
          String(tip),
        );
        forgetXmrStaleFirstAccount(accountId);
        // The runtime only moves its birthday earlier and keeps what it
        // scanned before a later start, so the stored birthday does too:
        // rebuilding from a later one would drop the funds in between.
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
