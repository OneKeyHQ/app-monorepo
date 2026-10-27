import {
  hasXmrRuntimeApiLoader,
  readXmrRuntimeError,
} from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { parseXmrTransaction } from '@onekeyhq/core/src/chains/xmr/transactionReview';
import {
  XMR_BUILT_IN_NODE_URLS,
  XMR_DECIMALS,
  XMR_EARLIEST_SCAN_HEIGHT,
  XMR_SEND_MAX_BLOCKS_LEFT,
  XMR_SYNC_EXPECTED_STEP_MS,
  XMR_SYNC_STEP_BLOCKS,
  XMR_SYNC_TURN_BUDGET_MS,
  XMR_SYNC_WATCHDOG_MS,
  XMR_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import {
  LOCAL_WALLET_DISPLAY_WAIT_MS,
  isLocalWalletCacheEpochCurrent,
  readLocalWalletBalanceStaleFirst,
  readLocalWalletCacheEpoch,
  saveLastLocalWalletBalance,
  saveLastLocalWalletChainTip,
} from '../../localWallet/privacyChainCacheStore';
import { runBoundedSyncTurn } from '../../localWallet/syncTurn';

import {
  XMR_BIRTHDAY_PENDING_SOURCE,
  estimateXmrBirthdayHeight,
  estimateXmrHeightDaysAgo,
} from './birthday';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { getXmrLifecycleMutex } from './lifecycle';
import {
  deleteXmrDatabase,
  forgetXmrStaleFirst,
  getXmrChainTip,
  getXmrIdentityId,
  getXmrLastKnownChainTip,
  getXmrLocalRuntime,
  getXmrNodeHealth,
  getXmrRuntime,
  getXmrRuntimeUuid,
  isXmrRuntimeBusy,
  readXmrStaleFirst,
} from './runtime';

import type Vault from './Vault';
import type { IXmrAccountScanState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import type {
  ILocalWalletAccount,
  ILocalWalletAccountAddresses,
  ILocalWalletAccountBalance,
  ILocalWalletAccountState,
  ILocalWalletCapability,
  ILocalWalletFrozenPart,
  ILocalWalletFrozenReason,
  ILocalWalletSyncPolicy,
  ILocalWalletSyncProgress,
} from '../../localWallet/types';

/** No public pool, so publicAddress and privateAddress are the same string; unverified balance is reported as frozen, not total. */

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
  const stateDb = () => vault.backgroundApi.simpleDb.privacyChainState;
  const { networkId } = vault;
  const lifecycleMutex = getXmrLifecycleMutex(networkId);

  const isCurrentRequest = async (
    accountId: string,
    expected: IXmrAccountScanState,
  ): Promise<boolean> => {
    const current = await stateDb().getXmrAccountState({ accountId });
    return (
      !current.deletionPending &&
      !expected.deletionPending &&
      current.epoch === expected.epoch &&
      current.intent === expected.intent &&
      current.operation === undefined &&
      current.birthdayHeight === expected.birthdayHeight &&
      current.birthdayTimestamp === expected.birthdayTimestamp &&
      current.birthdaySource === expected.birthdaySource
    );
  };

  const requireRuntime = () => getXmrRuntime(vault);

  const accountRuntimeId = async (accountId: string): Promise<string> =>
    getXmrIdentityId({
      api: await getXmrLocalRuntime(vault),
      vault,
      accountId,
    });

  // Registers an account identity from its saved birthday (no password needed); an identity
  // named by an old account id is renamed by the runtime, keeping its data and sends.
  const registerIdentity = async (
    accountId: string,
    birthdayHeight: number,
    expected?: IXmrAccountScanState,
    forceRescan = false,
  ): Promise<string | undefined> => {
    const owner =
      expected ?? (await stateDb().getXmrAccountState({ accountId }));
    const keys = await vault.getXmrViewingKeys({ accountId });
    const api = await getXmrLocalRuntime(vault);
    return lifecycleMutex.runExclusive(async () => {
      if (!(await isCurrentRequest(accountId, owner))) return undefined;
      const add = api.addAccount.bind(
        api,
        keys.vkFp,
        keys.spendPublicKeyHex,
        keys.viewPrivateKeyHex,
        String(birthdayHeight),
      );
      await (forceRescan ? add(true) : add());
      return accountRuntimeId(accountId);
    });
  };

  const deriveScanningAccountKey = async (accountId: string) => {
    const state = await stateDb().getXmrAccountState({ accountId });
    if (state.deletionPending) return false;
    if (state.intent !== 'on' && state.operation?.type !== 'enable')
      return false;
    const key = await vault.backgroundApi.servicePrivacyChain
      .ensureLocalWalletViewingKey({
        networkId,
        accountId,
        expectedEpoch: state.epoch,
      })
      .catch(() => undefined);
    return key !== undefined;
  };

  const getAccountAliases = async ({
    accountId,
  }: {
    accountId: string;
  }): Promise<string[]> => {
    const vkFp = await getXmrRuntimeUuid({ vault, accountId });
    if (vkFp === undefined) return [accountId];
    const aliases = [accountId];
    for (const otherId of await stateDb().listAccountIds({ networkId })) {
      if (
        otherId !== accountId &&
        // eslint-disable-next-line no-await-in-loop
        (await getXmrRuntimeUuid({ vault, accountId: otherId })) === vkFp
      ) {
        aliases.push(otherId);
      }
    }
    return aliases;
  };

  const ensureRegistered = async (
    accountId: string,
    chainTip: number,
  ): Promise<
    | {
        runtimeId: string;
        rewound: boolean;
        owner: IXmrAccountScanState;
      }
    | undefined
  > => {
    let state = await stateDb().getXmrAccountState({ accountId });
    if (
      state.deletionPending ||
      state.intent !== 'on' ||
      state.operation !== undefined
    )
      return undefined;
    if (
      state.birthdaySource === XMR_BIRTHDAY_PENDING_SOURCE &&
      state.birthdayTimestamp !== undefined
    ) {
      await stateDb().updateXmrBirthday({
        accountId,
        birthdayHeight: Math.max(
          XMR_EARLIEST_SCAN_HEIGHT,
          estimateXmrBirthdayHeight({
            birthdayTimestamp: state.birthdayTimestamp,
            now: Date.now(),
            chainTip,
          }),
        ),
        birthdayTimestamp: state.birthdayTimestamp,
        birthdaySource: 'restore-month',
        expectedState: state,
      });
      state = await stateDb().getXmrAccountState({ accountId });
    }
    if (
      state.intent !== 'on' ||
      state.operation !== undefined ||
      state.birthdaySource === XMR_BIRTHDAY_PENDING_SOURCE
    ) {
      return undefined;
    }
    let runtimeId: string;
    let created = false;
    try {
      runtimeId = await accountRuntimeId(accountId);
    } catch (error) {
      const latest = await stateDb().getXmrAccountState({ accountId });
      if (
        latest.epoch !== state.epoch ||
        latest.intent !== 'on' ||
        latest.operation !== undefined ||
        latest.birthdayHeight !== state.birthdayHeight ||
        latest.birthdayTimestamp !== state.birthdayTimestamp ||
        latest.birthdaySource !== state.birthdaySource
      )
        return undefined;
      if (state.intent !== 'on' || state.birthdayHeight === undefined) {
        throw error;
      }
      const birthdayHeight = Math.max(
        XMR_EARLIEST_SCAN_HEIGHT,
        Math.min(state.birthdayHeight, chainTip),
      );
      if (birthdayHeight !== state.birthdayHeight) {
        await stateDb().updateXmrBirthday({
          accountId,
          birthdayHeight,
          birthdayTimestamp: state.birthdayTimestamp,
          birthdaySource: 'automatic-recovery',
          expectedState: state,
        });
        const current = await stateDb().getXmrAccountState({ accountId });
        if (
          current.intent !== 'on' ||
          current.operation !== undefined ||
          current.birthdayHeight !== birthdayHeight ||
          current.birthdaySource !== 'automatic-recovery' ||
          current.birthdayTimestamp !== state.birthdayTimestamp
        )
          return undefined;
        state = current;
      }
      const registered = await registerIdentity(
        accountId,
        birthdayHeight,
        state,
        state.forceRescan,
      );
      if (registered === undefined) return undefined;
      runtimeId = registered;
      created = true;
    }
    const api = await getXmrLocalRuntime(vault);
    const peek = JSON.parse(await api.syncPeek(runtimeId)) as {
      birthdayHeight?: number;
    };
    const pendingPreparation =
      state.epoch !== undefined && state.appliedEpoch !== state.epoch;
    let rewound = false;
    if (
      !created &&
      state.birthdayHeight !== undefined &&
      (state.forceRescan || peek.birthdayHeight !== state.birthdayHeight)
    ) {
      const configured = await registerIdentity(
        accountId,
        state.birthdayHeight,
        state,
        state.forceRescan,
      );
      if (configured === undefined) return undefined;
      runtimeId = configured;
      forgetXmrStaleFirst(await getAccountAliases({ accountId }));
      rewound = true;
    }
    if (pendingPreparation && state.epoch !== undefined) {
      await stateDb().completeXmrPreparation({ accountId, epoch: state.epoch });
    }
    if (!(await isCurrentRequest(accountId, state))) return undefined;
    return { runtimeId, rewound, owner: state };
  };

  // "alias": another account keeps this identity scan data; "maybe": that cannot be ruled out.
  // Orphan cleanup settles "maybe" later. An alias being deleted keeps nothing.
  const identityHeldByOtherAccount = async ({
    accountId,
    vkFp,
  }: {
    accountId: string;
    vkFp: string;
  }): Promise<'no' | 'alias' | 'maybe'> => {
    const holders = await stateDb().listScanDataAccountIds({
      networkId,
      excludeDeleting: true,
    });
    if (!holders) return 'maybe';
    let held: 'no' | 'maybe' = 'no';
    for (const otherId of holders) {
      if (otherId === accountId) {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const otherVkFp = await stateDb().getAccountVkFp({
        networkId,
        accountId: otherId,
      });
      if (otherVkFp === vkFp) return 'alias';
      if (otherVkFp === undefined) held = 'maybe';
    }
    return held;
  };

  const readBalance = async (
    accountId: string,
  ): Promise<ILocalWalletAccountBalance | null> => {
    const api = await getXmrLocalRuntime(vault);
    const runtimeId = await getXmrIdentityId({ api, vault, accountId });
    const tip = await getXmrLastKnownChainTip(vault).catch(() => undefined);
    const raw = JSON.parse(
      await api.balance(runtimeId, tip === undefined ? undefined : String(tip)),
    ) as {
      totalAtomic: string;
      unlockedAtomic: string;
      unverifiableAtomic: string;
      pendingChangeAtomic: string;
    };
    // The remaining locked amount is the 10-block maturation lock.
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
    state: IXmrAccountScanState;
  }): Promise<ILocalWalletSyncProgress | undefined> => {
    const api = await getXmrLocalRuntime(vault);
    const runtimeId = await getXmrIdentityId({ api, vault, accountId }).catch(
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

    const birthday = peek.birthdayHeight ?? state.birthdayHeight ?? null;
    const scanned = peek.scannedToHeight;
    const remaining = peek.ranges.reduce(
      (sum, range) => sum + (range.end - range.start),
      0,
    );
    // Falls back to the first queued range so progress shows 0%, not blank.
    const backfillFrom = scanned ?? peek.ranges[0]?.start ?? null;
    const gap =
      chainTip !== null && scanned !== null ? chainTip - scanned : null;
    // One queue: while it holds ranges, the backfill already runs to the tip.
    const tipLag = remaining > 0 && gap !== null ? 0 : gap;

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
        gap !== null &&
        gap * XMR_TARGET_BLOCK_SECONDS <= XMR_TARGET_BLOCK_SECONDS * 2,
      isSyncing: remaining > 0,
    };
  };

  // A page turned away by a busy runtime asks the scan to save a balance after its step.
  const saveScannedBalance = async (
    accountId: string,
    epoch: string | undefined,
  ) => {
    try {
      const value = await readBalance(accountId);
      if (value) {
        await saveLastLocalWalletBalance({
          backgroundApi: vault.backgroundApi,
          networkId: vault.networkId,
          accountId,
          epoch,
          value,
        });
      }
    } catch (error) {
      console.warn('[xmr] could not save the scanned balance', { error });
    }
  };

  const staleFirstOwner = async (accountId: string) => {
    const epoch = await readLocalWalletCacheEpoch({
      backgroundApi: vault.backgroundApi,
      accountId,
    });
    return {
      epoch,
      isCurrent: () =>
        isLocalWalletCacheEpochCurrent({
          backgroundApi: vault.backgroundApi,
          accountId,
          epoch,
        }),
    };
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

  const enableAccount = async (
    {
      accountId,
      birthdayHeight,
      birthdayTimestamp,
    }: Parameters<ILocalWalletCapability['enableAccount']>[0],
    expectedState?: IXmrAccountScanState,
  ): Promise<void> => {
    const previous =
      expectedState ?? (await stateDb().getXmrAccountState({ accountId }));
    if (
      birthdayHeight !== undefined &&
      (!Number.isSafeInteger(birthdayHeight) || birthdayHeight < 0)
    ) {
      throw new OneKeyLocalError('xmr: invalid privacy birthday height');
    }
    if (
      birthdayTimestamp !== undefined &&
      (!Number.isFinite(birthdayTimestamp) || birthdayTimestamp <= 0)
    ) {
      throw new OneKeyLocalError('xmr: invalid privacy birthday timestamp');
    }
    const account = await vault.getXmrViewingKeys({ accountId });
    const pendingTimestamp =
      birthdayHeight === undefined &&
      (birthdayTimestamp !== undefined ||
        previous.birthdaySource === XMR_BIRTHDAY_PENDING_SOURCE);
    let height = birthdayHeight;
    if (height === undefined) {
      height = previous.birthdayHeight;
      if (
        pendingTimestamp ||
        (height === undefined && previous.resumeFromHeight !== undefined)
      )
        height = XMR_EARLIEST_SCAN_HEIGHT;
    }
    const timestamp =
      birthdayHeight === undefined
        ? (birthdayTimestamp ?? previous.birthdayTimestamp)
        : birthdayTimestamp;
    if (height === undefined || (pendingTimestamp && timestamp === undefined)) {
      throw new OneKeyLocalError('xmr: privacy birthday is required');
    }
    let birthdaySource = previous.birthdaySource;
    if (pendingTimestamp) birthdaySource = XMR_BIRTHDAY_PENDING_SOURCE;
    else if (birthdayHeight !== undefined) birthdaySource = 'manual-height';
    const accepted = await stateDb().saveXmrEnabledAccount({
      networkId,
      accountId,
      vkFp: account.vkFp,
      expectedState: previous,
      birthdayHeight: Math.max(XMR_EARLIEST_SCAN_HEIGHT, height),
      birthdayTimestamp: timestamp,
      birthdaySource,
    });
    if (accepted)
      void notifyAccountsChanged({ accountId, backfillActive: true });
    else if (!expectedState)
      throw new OneKeyLocalError(
        'xmr: privacy request changed during authorization',
      );
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
      const state = await stateDb().getXmrAccountState({ accountId });
      return {
        enabled: state.intent === 'on' && !state.operation,
        paused: state.intent === 'off' && state.resumeFromHeight !== undefined,
        pendingOperation: state.operation?.type,
        birthdayHeight: state.birthdayHeight,
        birthdaySource: state.birthdaySource,
        birthdayTimestamp: state.birthdayTimestamp,
      };
    },

    enableAccount,

    async disableAccount({ accountId }) {
      // Record the resume position first; losing it means a full rescan.
      const progress = await this.getSyncProgress({ accountId });
      const state = await stateDb().getXmrAccountState({ accountId });
      await stateDb().saveXmrDisabledAccount({
        accountId,
        resumeFromHeight:
          progress?.tipScannedHeight ?? state.birthdayHeight ?? 0,
      });
      await notifyAccountsChanged({ accountId, backfillActive: false });
    },

    async retryAccountSetup({ accountId }) {
      const state = await stateDb().getXmrAccountState({ accountId });
      if (state.operation?.type === 'enable') {
        if (!(await deriveScanningAccountKey(accountId))) return;
        await enableAccount(
          {
            accountId,
            birthdayHeight:
              state.birthdaySource === XMR_BIRTHDAY_PENDING_SOURCE
                ? undefined
                : state.birthdayHeight,
            birthdayTimestamp: state.birthdayTimestamp,
          },
          state,
        );
        return;
      }
      if (state.operation?.type === 'disable') {
        await stateDb().completeXmrDisable({ accountId, expectedState: state });
      }
    },

    async getAccountAddresses({
      accountId,
    }): Promise<ILocalWalletAccountAddresses | undefined> {
      const account = await vault.backgroundApi.serviceAccount
        .getAccount({ accountId, networkId: vault.networkId })
        .catch(() => undefined);
      if (!account?.address) return undefined;
      const state = await stateDb().getXmrAccountState({ accountId });
      const enabled = state.intent === 'on' && !state.operation;
      return {
        publicAddress: account.address,
        // Exposed as private only while scanning, or we'd promise visibility
        // we don't have.
        privateAddress: enabled ? account.address : undefined,
      };
    },

    async deriveViewingKey({ accountId, password, deviceParams }) {
      if (vault.accountId === accountId) {
        if (vault.keyring instanceof KeyringHardware && deviceParams) {
          return vault.keyring.xmrGetViewingKeyFromDevice({ deviceParams });
        }
        if (vault.keyring instanceof KeyringHd && password) {
          return vault.keyring.xmrDeriveViewingKey({ password });
        }
      }
      throw new OneKeyLocalError(
        'xmr: viewing key derivation needs this account and its password or device',
      );
    },

    async deleteRuntimeAccount({ accountId, deletionRequestId }) {
      return lifecycleMutex.runExclusive(async () => {
        if (
          deletionRequestId !== undefined &&
          !(await stateDb().isAccountDeletionPending({
            accountId,
            requestId: deletionRequestId,
          }))
        )
          return { orphaned: false };
        if (!hasXmrRuntimeApiLoader()) return { orphaned: false };
        // The record keeps the identity until the runtime step is done; no key needed.
        const vkFp = await stateDb().getAccountVkFp({ networkId, accountId });
        if (vkFp === undefined) return { orphaned: true };
        const held = await identityHeldByOtherAccount({ accountId, vkFp });
        if (held !== 'no') return { orphaned: held === 'maybe' };
        const api = await getXmrLocalRuntime(vault);
        await api.removeAccount(vkFp);
        return { orphaned: false };
      });
    },

    async forgetMemoryCaches({ accountIds }) {
      forgetXmrStaleFirst(accountIds);
      for (const key of xmrBalanceWanted) {
        if (
          !accountIds ||
          accountIds.some((accountId) => key === `${networkId}:${accountId}`)
        ) {
          xmrBalanceWanted.delete(key);
        }
      }
    },

    async getAccountBalance({
      accountId,
    }): Promise<ILocalWalletAccountBalance | null> {
      const state = await stateDb().getXmrAccountState({ accountId });
      // A paused account keeps its scanned data; its last balance is real, just not advancing.
      const paused =
        state.intent === 'off' && state.resumeFromHeight !== undefined;
      if (
        state.deletionPending ||
        (state.intent !== 'on' && !paused) ||
        state.operation
      )
        return null;
      if (!paused && state.epoch !== state.appliedEpoch) return null;
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
      return result.value;
    },

    listSendPools: undefined,

    syncPolicy,

    async listAccounts() {
      const enabled = await stateDb().listXmrEnabledAccountIds({ networkId });
      const accounts: ILocalWalletAccount[] = [];
      for (const accountId of enabled) {
        accounts.push({
          accountId,
          runtimeKey: 'xmr-mainnet',
          // Aliases share one identity, and so one slot. Without a stored key
          // the account is its own until the key is derived again.
          accountRuntimeKey:
            // eslint-disable-next-line no-await-in-loop
            (await getXmrRuntimeUuid({ vault, accountId })) ?? accountId,
          syncEnabled: true,
        });
      }
      return {
        accounts,
        // Lets GC drop accounts whose app account was deleted, including
        // their view key on disk.
        cleanupAccountIds: await stateDb().listAccountIds({ networkId }),
      };
    },

    getAccountAliases,

    async getChainTip() {
      if (!hasXmrRuntimeApiLoader()) return null;
      const tip = await getXmrChainTip(await requireRuntime());
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

    async onWalletCreated() {},

    async resumePendingOperations() {
      const pending = await stateDb().listXmrPendingOperations({
        networkId,
        startedBefore: XMR_PROCESS_STARTED_AT,
      });
      for (const item of pending) {
        // eslint-disable-next-line no-await-in-loop
        await this.retryAccountSetup({ accountId: item.accountId });
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
      let synced = false;
      const steppedRuntimeIds = new Set<string>();
      const caughtUpRuntimeIds = new Set<string>();
      const admittedAccounts: {
        accountId: string;
        runtimeId: string;
        owner: IXmrAccountScanState;
      }[] = [];
      let skipped = 0;

      for (const accountId of accountIds) {
        // An account whose key cannot be read yet (locked wallet) waits for unlock; keys are derived
        // only for accounts still scanning, as this turn list may predate a delete.
        if (
          // eslint-disable-next-line no-await-in-loop
          (await getXmrRuntimeUuid({ vault, accountId })) === undefined &&
          // eslint-disable-next-line no-await-in-loop
          !(await deriveScanningAccountKey(accountId))
        ) {
          skipped += 1;
          // eslint-disable-next-line no-continue
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const registered = await ensureRegistered(accountId, tip);
        if (registered === undefined) {
          skipped += 1;
          // eslint-disable-next-line no-continue
          continue;
        }
        const { runtimeId, rewound, owner } = registered;
        // The admitted account list may precede a delete or birthday request; Worker mutations check their owner.
        // eslint-disable-next-line no-await-in-loop, no-continue
        if (!(await isCurrentRequest(accountId, owner))) continue;
        admittedAccounts.push({ accountId, runtimeId, owner });
        if (rewound) {
          caughtUpRuntimeIds.delete(runtimeId);
          stateChanged = true;
          // This alias may rewind an identity already stepped this turn.
          backfillRemaining = true;
        }
        if (steppedRuntimeIds.has(runtimeId)) {
          // eslint-disable-next-line no-continue
          continue;
        }
        steppedRuntimeIds.add(runtimeId);
        // eslint-disable-next-line no-await-in-loop
        await lifecycleMutex.runExclusive(async () => {
          if (await isCurrentRequest(accountId, owner)) {
            await api.updateChainTip(runtimeId, String(tip));
          }
        });
        // eslint-disable-next-line no-await-in-loop
        const result = await runBoundedSyncTurn({
          budgetMs: turn.budgetMs,
          expectedStepMs: turn.expectedStepMs,
          onStep: async () => {
            if (await isCurrentRequest(accountId, owner)) {
              await vault.backgroundApi.servicePrivacyChain.publishLocalWalletSyncProgress(
                { networkId: vault.networkId, accountIds: [accountId] },
              );
            }
          },
          step: () =>
            lifecycleMutex.runExclusive(async () => {
              if (!(await isCurrentRequest(accountId, owner))) {
                return { done: true, stateChanged: false };
              }
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
                  if (!(await isCurrentRequest(accountId, owner)))
                    return { done: true, stateChanged: false };
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
              };
              if (!(await isCurrentRequest(accountId, owner)))
                return { done: true, stateChanged: false };
              if (xmrBalanceWanted.delete(`${vault.networkId}:${accountId}`)) {
                await saveScannedBalance(accountId, owner.epoch);
              }
              return {
                done: progress.done,
                stateChanged:
                  progress.outputsFound > 0 ||
                  (progress.spendsDetected ?? 0) > 0 ||
                  (progress.sendsFailed ?? 0) > 0 ||
                  (progress.sendsRestored ?? 0) > 0,
              };
            }),
        });
        // eslint-disable-next-line no-await-in-loop, no-continue
        if (!(await isCurrentRequest(accountId, owner))) continue;
        synced = true;
        if (result.done) caughtUpRuntimeIds.add(runtimeId);
        if (result.stateChanged) stateChanged = true;
        if (!result.done) backfillRemaining = true;
      }

      if (skipped) {
        console.warn('[xmr] accounts waiting for their view key', {
          count: skipped,
        });
      }
      if (!synced) {
        return { synced: false };
      }
      const caughtUpAccountIds: string[] = [];
      for (const admitted of admittedAccounts) {
        if (
          caughtUpRuntimeIds.has(admitted.runtimeId) &&
          // eslint-disable-next-line no-await-in-loop
          (await isCurrentRequest(admitted.accountId, admitted.owner))
        ) {
          caughtUpAccountIds.push(admitted.accountId);
        }
      }
      return {
        synced: true,
        stateChanged,
        chainTip: tip,
        backfillRemaining,
        caughtUpAccountIds,
      };
    },

    async rewindAccount({ accountId }) {
      const state = await stateDb().getXmrAccountState({ accountId });
      if (state.intent === 'on' && state.birthdayHeight !== undefined) {
        await this.rescan({
          accountId,
          from: { type: 'height', height: state.birthdayHeight },
        });
      }
    },

    // Runtime calls are serialized in runtime.ts; the Rust runtime refuses a second writer (WALLET_BUSY).
    syncCompletionIsAuthoritative: true,

    async recoverFromTimeout() {
      return false;
    },

    async getStorageUsage() {
      if (!hasXmrRuntimeApiLoader()) return { bytes: null };
      // Opening the runtime creates its database; measuring must not.
      const holders = await stateDb().listScanDataAccountIds({ networkId });
      if (!holders?.length) return { bytes: 0 };
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

    // Deletes the DB without opening it (an unopenable DB stays recoverable), then re-registers every
    // account holding scan data from its saved birthday. The caller rotates their epochs first.
    async resetStorage() {
      if (!hasXmrRuntimeApiLoader()) return;
      await deleteXmrDatabase(await vault.getXmrNetwork());
      const holders =
        (await stateDb().listScanDataAccountIds({ networkId })) ?? [];
      // The database is gone either way. An account whose key is locked
      // keeps its state: the next scan or resume registers it again.
      for (const accountId of holders) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const state = await stateDb().getXmrAccountState({ accountId });
          if (state.birthdayHeight !== undefined) {
            // eslint-disable-next-line no-await-in-loop
            await registerIdentity(accountId, state.birthdayHeight);
          }
        } catch (error) {
          console.warn('[xmr] account left to register on its next scan', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },

    listScanDataAccountIds: () =>
      stateDb().listScanDataAccountIds({ networkId }),

    async purgeRuntimeOrphans({ retained }) {
      if (!hasXmrRuntimeApiLoader()) return true;
      // A held runtime may be a stuck call; queueing behind it would stall
      // the scheduler's turn.
      if (isXmrRuntimeBusy()) return false;
      const api = await getXmrLocalRuntime(vault);
      const listed = JSON.parse(await api.listAccounts()) as {
        items: { uuid: string }[];
      };
      const keep = new Set(retained.map(({ vkFp }) => vkFp));
      const orphans = listed.items.filter(({ uuid }) => !keep.has(uuid));
      for (const { uuid } of orphans) {
        if (resetUtils.getIsResetting()) return false;
        // eslint-disable-next-line no-await-in-loop
        await api.removeAccount(uuid);
      }
      if (orphans.length) {
        console.log('[xmr] removed runtime identities no account keeps', {
          count: orphans.length,
        });
      }
      return true;
    },

    async hasLocalData() {
      if ((await stateDb().listAccountIds({ networkId })).length > 0) {
        return true;
      }
      return stateDb().hasRuntimeOrphans({ networkId });
    },

    // App reset: deletes even with no account state left, since a
    // pre-existing or half-failed-reset database can still hold view keys.
    async dropLocalData() {
      if (hasXmrRuntimeApiLoader()) {
        await deleteXmrDatabase(await vault.getXmrNetwork());
      }
    },

    async getSyncProgress({
      accountId,
    }): Promise<ILocalWalletSyncProgress | undefined> {
      if (!hasXmrRuntimeApiLoader()) return undefined;
      const state = await stateDb().getXmrAccountState({ accountId });
      if (state.intent !== 'on') return undefined;
      if (state.epoch !== state.appliedEpoch) return undefined;

      return readXmrStaleFirst({
        key: `progress:${accountId}`,
        owner: await staleFirstOwner(accountId),
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
      const current = dryRun
        ? undefined
        : await stateDb().getXmrAccountState({ accountId });
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

      if (
        !current ||
        current.intent !== 'on' ||
        current.operation !== undefined
      )
        throw new OneKeyLocalError('xmr: enable privacy before rescanning');
      const keys = await vault.getXmrViewingKeys({ accountId });
      fromHeight = Math.max(XMR_EARLIEST_SCAN_HEIGHT, fromHeight);
      let birthdayTimestamp: number | undefined;
      if (from.type === 'timestamp') birthdayTimestamp = from.timestamp;
      else if (from.type === 'daysAgo')
        birthdayTimestamp = Date.now() - from.daysAgo * 24 * 60 * 60 * 1000;
      const accepted = await stateDb().saveXmrEnabledAccount({
        networkId,
        accountId,
        vkFp: keys.vkFp,
        birthdayHeight: fromHeight,
        birthdaySource:
          from.type === 'height' ? 'manual-height' : 'restore-month',
        birthdayTimestamp,
        forceRescan: true,
        expectedState: current,
      });
      if (accepted)
        void notifyAccountsChanged({ accountId, backfillActive: true });
      return { fromHeight };
    },
  };
}
