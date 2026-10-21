import { uniq } from 'lodash';

import {
  ZCASH_LIGHTWALLETD_MAINNET,
  ZCASH_NETWORK_MAIN,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { readZcashRuntimeError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/runtimeError';
import type {
  IZcashSyncProgress,
  IZcashWalletAccount,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { isSameZcashPendingRescan } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { getPrivacyModeResumeFromHeight } from '../../../services/PrivacyModeState';
import {
  getLastLocalWalletChainTip,
  saveLastLocalWalletChainTip,
} from '../../localWallet/privacyChainCacheStore';

import {
  clampZcashBirthdayHeight,
  estimateZcashBirthdayHeight,
} from './birthday';
import { KeyringHardware } from './KeyringHardware';
import {
  ZCASH_PROCESS_STARTED_AT,
  forgetIdleZcashLifecycleMutexes,
  getZcashAccountLifecycleMutex,
  getZcashLifecycleMutex,
  getZcashSyncMutex,
} from './lifecycle';
import { parseZcashTransaction } from './transactionReview';
import { forgetZcashTransparentDisplayReads } from './vaultBalance';
import { forgetZcashTransparentHistorySnapshots } from './vaultHistory';
import { ZCASH_TRANSPARENT_DROP_MARGIN_BLOCKS } from './vaultTransparent';
import {
  ZCASH_WORKER_RESET_TIMEOUT_MS,
  createZcashSetupIncompleteError,
  isZcashRuntimeDatabaseBroken,
  isZcashSetupIncompleteError,
  zcashDescribeError,
  zcashIdentityMismatchAccountIds,
  zcashLastPrivateHistory,
  zcashUserOperationsActive,
} from './vaultUtils';

import type { KeyringHd } from './KeyringHd';
import type Vault from './Vault';
import type { IDBUtxoAccount } from '../../../dbs/local/types';
import type {
  IZcashBirthdaySource,
  IZcashPendingRescan,
  IZcashPrivacyModeStateView,
} from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import type {
  ILocalWalletCapability,
  ILocalWalletRetainedIdentity,
} from '../../localWallet/types';
import type { IRescanLocalWalletFrom } from '../../types';

async function listZcashCleanupAccountIds(vault: Vault): Promise<string[]> {
  const [stateAccountIds, journalAccountIds] = await Promise.all([
    vault.backgroundApi.simpleDb.privacyChainState.listAccountIds({
      networkId: vault.networkId,
    }),
    vault.backgroundApi.simpleDb.privacyChainJournal.listZcashTransparentAccountIds(),
  ]);
  return uniq([...stateAccountIds, ...journalAccountIds]);
}

// Without its key nothing can name the runtime account; the orphan cleanup
// purges it once every key it must keep reads.
async function purgeZcashRuntimeAccount(
  vault: Vault,
  accountId: string,
): Promise<{ orphaned: boolean }> {
  let account: IZcashWalletAccount;
  try {
    account = await vault.zcashGetWalletAccount({ accountId });
  } catch (e) {
    if (isZcashSetupIncompleteError(e)) {
      return { orphaned: true };
    }
    throw e;
  }
  const api = await vault.zcashGetApi();
  await api.purgeWallet(account);
  return { orphaned: false };
}

// Uses the last saved tip: an older tip only keeps more sends, and the
// clear must not wait on loading the runtime.
async function clearZcashPendingSends(
  vault: Vault,
  {
    networkId,
    accountId,
    scope,
  }: { networkId: string; accountId: string; scope: 'pending' | 'expired' },
): Promise<void> {
  if (networkId !== vault.networkId) {
    throw new OneKeyLocalError(
      'zcash: pending sends belong to another network',
    );
  }
  const tip = await getLastLocalWalletChainTip({
    backgroundApi: vault.backgroundApi,
    networkId,
  }).catch(() => undefined);
  await vault.backgroundApi.simpleDb.privacyChainJournal.clearTransparentPendingSends(
    {
      accountId,
      expiredBeforeHeight:
        tip === undefined
          ? undefined
          : tip - ZCASH_TRANSPARENT_DROP_MARGIN_BLOCKS,
      scope,
    },
  );
}

// The tip only feeds month-based birthday estimates, so it is saved when it
// moved far enough or long enough ago, sparing the shared app storage a
// rewrite every block. Best-effort: a failed save never fails the fetch.
const ZCASH_CHAIN_TIP_SAVE_MIN_BLOCKS = 100;
const ZCASH_CHAIN_TIP_SAVE_MIN_MS = timerUtils.getTimeDurationMs({
  minute: 10,
});
const zcashLastSavedChainTip = new Map<
  string,
  { height: number; at: number }
>();

async function saveZcashChainTip(vault: Vault, height: number): Promise<void> {
  const last = zcashLastSavedChainTip.get(vault.networkId);
  if (
    last &&
    Math.abs(height - last.height) < ZCASH_CHAIN_TIP_SAVE_MIN_BLOCKS &&
    Date.now() - last.at < ZCASH_CHAIN_TIP_SAVE_MIN_MS
  ) {
    return;
  }
  try {
    await saveLastLocalWalletChainTip({
      backgroundApi: vault.backgroundApi,
      networkId: vault.networkId,
      height,
    });
    zcashLastSavedChainTip.set(vault.networkId, { height, at: Date.now() });
  } catch (e) {
    console.error('[zcash] could not save the chain tip', {
      ...zcashDescribeError(e),
    });
  }
}

// Every in-memory copy of an account's data, or of every account's.
function forgetZcashMemoryCaches(vault: Vault, accountIds?: string[]) {
  forgetZcashTransparentDisplayReads({
    networkId: vault.networkId,
    accountIds,
  });
  forgetZcashTransparentHistorySnapshots({
    networkId: vault.networkId,
    accountIds,
  });
  if (!accountIds) {
    zcashLastPrivateHistory.clear();
    zcashIdentityMismatchAccountIds.clear();
    return;
  }
  for (const accountId of accountIds) {
    zcashLastPrivateHistory.delete(accountId);
    zcashIdentityMismatchAccountIds.delete(accountId);
  }
}

export function getLocalWalletCapability(vault: Vault): ILocalWalletCapability {
  return {
    reviewTransaction: (encodedTx) => {
      const tx = parseZcashTransaction(encodedTx);
      return {
        encodedTx: tx,
        to: tx.zcashTo,
        amount: tx.zcashAmountValue,
        fee: tx.fee,
      };
    },
    syncPolicy: {
      maxSyncDurationMs: timerUtils.getTimeDurationMs({ minute: 5 }),
      foregroundBackfillDelayMs: 500,
      backgroundBackfillDelayMs: {
        desktop: timerUtils.getTimeDurationMs({ seconds: 5 }),
        default: timerUtils.getTimeDurationMs({ seconds: 30 }),
      },
    },
    listAccounts: () => vault.listLocalWalletAccounts(),
    listScanDataAccountIds: () =>
      vault.backgroundApi.simpleDb.privacyChainState.listScanDataAccountIds({
        networkId: vault.networkId,
      }),
    purgeRuntimeOrphans: (params) => zcashPurgeRuntimeOrphans(vault, params),
    listSendPools: (params) => vault.listLocalWalletSendPools(params),
    prewarmSend: (params) => vault.prewarmLocalWalletSend(params),
    getAccountAliases: (params) => vault.getLocalWalletAccountAliases(params),
    getChainTip: async () => {
      const tip = await vault.getLocalWalletChainTip();
      // Gives month-based birthday estimates a tip without a node call.
      if (tip !== null) {
        await saveZcashChainTip(vault, tip);
      }
      return tip;
    },
    onWalletCreated: (params) => vault.onPrivacyWalletCreated(params),
    resumePendingOperations: () => vault.resumePendingPrivacyOperations(),
    syncGroup: (params) => vault.syncLocalWalletGroup(params),
    syncCompletionIsAuthoritative:
      !platformEnv.isNative && !platformEnv.isExtension,
    rewindAccount: (params) => vault.zcashRewindAccount(params),
    deleteRuntimeAccount: (params) => vault.zcashDeleteRuntimeAccount(params),
    forgetMemoryCaches: async ({ accountIds }) => {
      forgetZcashMemoryCaches(vault, accountIds);
      forgetIdleZcashLifecycleMutexes();
      if (!accountIds) {
        zcashLastSavedChainTip.clear();
      }
    },
    recoverFromTimeout: () => vault.recoverLocalWalletFromTimeout(),
    isUserOperationActive: zcashUserOperationsActive,
    getStorageUsage: async () => {
      // Diagnostics checks existence first, so this can't create a database for an account that never enabled privacy.
      const api = await vault.zcashGetApi();
      const diagnostics = await api.diagnoseWalletDatabase({
        network: ZCASH_NETWORK_MAIN,
      });
      if (!diagnostics.databaseExists) {
        return { bytes: 0 };
      }
      return { bytes: diagnostics.storageStats?.sqlite.logicalBytes ?? null };
    },
    getSyncEndpoint: async () => {
      const api = await vault.zcashGetApi();
      const [health, url] = await Promise.all([
        api.getEndpointHealth().catch(() => undefined),
        vault.zcashResolveLightwalletdUrl(),
      ]);
      return {
        url,
        defaultUrl: ZCASH_LIGHTWALLETD_MAINNET,
        health: health?.url === url ? health : undefined,
      };
    },
    // A record holds or may hold scan data; so does a network where an
    // account went without its key naming the runtime account.
    hasLocalData: async () => {
      if ((await listZcashCleanupAccountIds(vault)).length > 0) {
        return true;
      }
      return vault.backgroundApi.simpleDb.privacyChainState.hasRuntimeOrphans({
        networkId: vault.networkId,
      });
    },
    dropLocalData: async () => {
      const api = await vault.zcashGetApi();
      await api.dropWalletDatabase(ZCASH_NETWORK_MAIN);
    },
    clearPendingSends: (params) => clearZcashPendingSends(vault, params),
    setDiagnosticsEnabled: (params) => vault.zcashSetPerfTrace(params),
    getSyncProgress: (params) => vault.getLocalWalletSyncProgress(params),
    rescan: (params) => vault.rescanLocalWallet(params),
    // ZcashPrivacyMode owns the mutexes/journal; this only maps its state into the chain-agnostic shape.
    getAccountState: async ({ accountId }) => {
      const state = await vault.zcashPrivacyMode().getPrivacyModeState({
        accountId,
      });
      return {
        enabled: state.intent === 'on' && state.operation === undefined,
        // A pause keeps a resume position; a never-enabled account has none.
        paused:
          state.intent !== 'on' &&
          state.operation === undefined &&
          state.resumeFromHeight !== undefined,
        pendingOperation: state.operation?.type,
        birthdayHeight: state.birthdayHeight,
        birthdaySource: state.birthdaySource,
        birthdayTimestamp: state.birthdayTimestamp,
        birthdayHintTimestamp: state.birthdayMonthHint?.timestamp,
      };
    },
    getAccountBalance: ({ accountId }) =>
      vault.getLocalWalletAccountBalance({ accountId }),
    enableAccount: (params) =>
      vault.zcashPrivacyMode().enablePrivacyMode({
        networkId: vault.networkId,
        ...params,
      }),
    disableAccount: ({ accountId }) =>
      vault.zcashPrivacyMode().disablePrivacyMode({
        networkId: vault.networkId,
        accountId,
      }),
    retryAccountSetup: ({ accountId }) =>
      vault.zcashPrivacyMode().enablePrivacyMode({
        networkId: vault.networkId,
        accountId,
      }),
    getAccountAddresses: async ({ accountId }) => {
      // Transparent address is account backbone, not privacy material -- available even while Privacy Mode is paused.
      const dbAccount = (await vault.backgroundApi.serviceAccount
        .getDBAccountSafe({ accountId })
        .catch(() => null)) as IDBUtxoAccount | null;
      // Imported and watch-only accounts have no privacy material to read.
      const meta = vault.supportsAccountWalletType({ accountId })
        ? await vault.zcashPrivacyMode().getLocalWalletAccountMeta({
            networkId: vault.networkId,
            accountId,
          })
        : undefined;
      const publicAddress = meta?.transparentAddress ?? dbAccount?.address;
      if (!publicAddress) {
        return undefined;
      }
      // No private address while not scanning: handing one out risks a payment landing where it can't be seen.
      return { publicAddress, privateAddress: meta?.unifiedAddress };
    },
    getDebugAccountMeta: ({ accountId }) =>
      vault.zcashPrivacyMode().getLocalWalletAccountMeta({
        networkId: vault.networkId,
        accountId,
      }),
  };
}

// Only a freshly generated mnemonic can safely start scanning at the tip; anything else must assume older history exists.
// The recovery month an account recommends is read from this, not copied.
export async function onPrivacyWalletCreated(
  vault: Vault,
  {
    walletId,
    isFreshlyGeneratedMnemonic,
    createdAt,
  }: {
    walletId: string;
    isFreshlyGeneratedMnemonic: boolean;
    createdAt: number;
  },
): Promise<void> {
  await vault.backgroundApi.simpleDb.privacyChainState.saveWalletCreationProvenance(
    {
      walletId,
      isFreshlyGeneratedMnemonic,
      createdAt,
    },
  );
}

export async function resumePendingPrivacyOperations(
  vault: Vault,
): Promise<void> {
  const requestedBefore = ZCASH_PROCESS_STARTED_AT;
  await vault.backgroundApi.simpleDb.privacyChainState.cancelZcashPendingEnables(
    { networkId: vault.networkId, requestedBefore },
  );
  const accountIds =
    await vault.backgroundApi.simpleDb.privacyChainState.listZcashPendingDisables(
      { networkId: vault.networkId, requestedBefore },
    );
  for (const accountId of accountIds) {
    // eslint-disable-next-line no-await-in-loop
    await vault.backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeDisable(
      {
        accountId,
      },
    );
  }
}

export async function listLocalWalletAccounts(vault: Vault): Promise<{
  accounts: {
    accountId: string;
    runtimeKey: string;
    accountRuntimeKey: string;
    syncEnabled: boolean;
    slotEnabled: boolean;
  }[];
  cleanupAccountIds: string[];
  storedAccountIds: string[];
}> {
  const [accountIds, metas, enabledAccountIds, { wallets }] = await Promise.all(
    [
      vault.backgroundApi.simpleDb.privacyChainState.listZcashMetaAccountIds({
        networkId: vault.networkId,
      }),
      vault.backgroundApi.simpleDb.privacyChainState.listZcashAccountMetas({
        networkId: vault.networkId,
      }),
      vault.backgroundApi.simpleDb.privacyChainState.listZcashEnabledAccountIds(
        {
          networkId: vault.networkId,
        },
      ),
      vault.backgroundApi.serviceAccount.getWallets({
        nestedHiddenWallets: false,
      }),
    ],
  );
  const enabled = new Set(enabledAccountIds);
  // A locked or unsaved ('do not save') wallet does not scan, but keeps its admission slot and resumes once saved and unlocked.
  const scannableWalletIds = new Set(
    wallets.flatMap((wallet) => (wallet.isTemp ? [] : [wallet.id])),
  );
  const accounts: {
    accountId: string;
    runtimeKey: string;
    accountRuntimeKey: string;
    syncEnabled: boolean;
    slotEnabled: boolean;
  }[] = [];
  for (const { accountId, meta } of metas) {
    accounts.push({
      accountId,
      // One database per network across every seed; the scheduler key must match that domain for one tip to mean one scan turn.
      runtimeKey: ZCASH_NETWORK_MAIN,
      accountRuntimeKey: meta.vkFp,
      slotEnabled: enabled.has(accountId),
      syncEnabled:
        enabled.has(accountId) &&
        scannableWalletIds.has(
          accountUtils.getWalletIdFromAccountId({ accountId }),
        ),
    });
  }
  return {
    accounts,
    cleanupAccountIds: await listZcashCleanupAccountIds(vault),
    // Accounts with viewing metadata or scanning; a record left by a
    // cancelled enable or a deletion holds no data.
    storedAccountIds: uniq([...accountIds, ...enabledAccountIds]),
  };
}

export async function getLocalWalletAccountAliases(
  vault: Vault,
  {
    accountId,
  }: {
    accountId: string;
  },
): Promise<string[]> {
  const targetMeta =
    await vault.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
      accountId,
    });
  if (!targetMeta) {
    return [accountId];
  }
  const metas =
    await vault.backgroundApi.simpleDb.privacyChainState.listZcashAccountMetas({
      networkId: vault.networkId,
    });
  return metas.flatMap((item) =>
    item.meta.vkFp === targetMeta.vkFp ? [item.accountId] : [],
  );
}

// Orphan cleanup: the runtime drops every account whose UFVK is not retained.
// Runs under the scan lane, never behind a held one (it may be stuck).
export async function zcashPurgeRuntimeOrphans(
  vault: Vault,
  { retained }: { retained: ILocalWalletRetainedIdentity[] },
): Promise<boolean> {
  const syncMutex = getZcashSyncMutex(ZCASH_NETWORK_MAIN);
  if (syncMutex.isLocked()) {
    return false;
  }
  return syncMutex.runExclusive(async () => {
    const metas =
      await vault.backgroundApi.simpleDb.privacyChainState.listZcashAccountMetas(
        {
          networkId: vault.networkId,
        },
      );
    const metaVkFps = new Map(
      metas.map(({ accountId, meta }) => [accountId, meta.vkFp]),
    );
    // A key that names another identity than its account record is a broken
    // setup; nothing is purged until Repair settles it.
    if (
      retained.some(
        ({ accountId, vkFp }) =>
          metaVkFps.has(accountId) && metaVkFps.get(accountId) !== vkFp,
      )
    ) {
      return false;
    }
    // The runtime opens its database through an account; use one the scan
    // registers anyway, so this registers nothing new.
    const { accounts } = await vault.listLocalWalletAccounts();
    const retainedIds = new Set(retained.map(({ accountId }) => accountId));
    const opener = accounts.find(
      ({ accountId, syncEnabled }) => syncEnabled && retainedIds.has(accountId),
    );
    if (!opener) {
      return false;
    }
    const account = await vault.zcashGetWalletAccount({
      accountId: opener.accountId,
    });
    const api = await vault.zcashGetApi();
    await api.prepareWalletAccounts([account], {
      retainedUfvks: uniq(retained.map(({ viewingKey }) => viewingKey)),
    });
    return true;
  });
}

export async function zcashPrepareAccounts(
  vault: Vault,
  {
    accountIds,
    chainTip,
  }: {
    accountIds: string[];
    chainTip?: number | null;
  },
): Promise<IZcashWalletAccount[]> {
  const accounts: IZcashWalletAccount[] = [];
  for (const accountId of accountIds) {
    // eslint-disable-next-line no-await-in-loop
    accounts.push(await vault.zcashGetWalletAccount({ accountId }));
  }
  await vault.zcashHealOutOfRangeBirthdays({ accountIds, accounts, chainTip });
  const api = await vault.zcashGetApi();
  // No purge here: orphans go only through the gated cleanup.
  await api.prepareWalletAccounts(accounts);

  // A later alias can register the same UFVK with an earlier birthday than already registered; detect and repair via the durable journal.
  const groups = new Map<
    string,
    { accountId: string; account: IZcashWalletAccount; aliases: string[] }
  >();
  for (let index = 0; index < accounts.length; index += 1) {
    const candidate = accounts[index];
    const existing = groups.get(candidate.ufvk);
    if (!existing) {
      groups.set(candidate.ufvk, {
        accountId: accountIds[index],
        account: candidate,
        aliases: [accountIds[index]],
      });
    } else {
      existing.aliases.push(accountIds[index]);
      if (
        candidate.birthdayHeight !== undefined &&
        (existing.account.birthdayHeight === undefined ||
          candidate.birthdayHeight < existing.account.birthdayHeight)
      ) {
        existing.accountId = accountIds[index];
        existing.account = candidate;
      }
    }
  }
  let repairedBirthday = false;
  for (const group of groups.values()) {
    const expectedBirthday = group.account.birthdayHeight;
    if (expectedBirthday === undefined) {
      // eslint-disable-next-line no-continue
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const progress = await api.getSyncProgress(group.account);
    if (
      progress.birthdayHeight === null ||
      progress.birthdayHeight <= expectedBirthday
    ) {
      // eslint-disable-next-line no-continue
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const meta = await vault.zcashGetAccountMeta({
      accountId: group.accountId,
    });
    const repair: IZcashPendingRescan = {
      birthdayHeight: expectedBirthday,
      birthdaySource: meta?.birthdaySource ?? 'automatic-recovery',
      birthdayTimestamp: meta?.birthdayTimestamp,
      requestedAt: Date.now(),
    };
    // eslint-disable-next-line no-await-in-loop
    await vault.backgroundApi.simpleDb.privacyChainState.saveZcashPendingRescan(
      {
        accountId: group.accountId,
        repair,
      },
    );
    try {
      // eslint-disable-next-line no-await-in-loop
      await vault.applyPendingRescan({
        accountId: group.accountId,
        repair,
      });
      repairedBirthday = true;
    } catch (e) {
      // An unsettled outgoing send returns WALLET_BUSY; keep the journal and retry after it settles.
      console.log('[zcash] earlier birthday repair deferred', {
        accountId: group.accountId,
        ...zcashDescribeError(e),
      });
    }
  }
  if (repairedBirthday) {
    await api.prepareWalletAccounts(accounts);
  }
  return accounts;
}

// Clamping a birthday only ever costs scan time, never funds. Left
// unclamped, one out-of-range birthday throws and stalls the whole batch.
export async function zcashHealOutOfRangeBirthdays(
  vault: Vault,
  {
    accountIds,
    accounts,
    chainTip,
  }: {
    accountIds: string[];
    accounts: IZcashWalletAccount[];
    chainTip?: number | null;
  },
): Promise<void> {
  const persist = async (index: number, height: number, why: string) => {
    const accountId = accountIds[index];
    console.log('[zcash] healing out-of-range birthday', {
      accountId,
      storedBirthday: accounts[index].birthdayHeight,
      healedTo: height,
      why,
    });
    const meta = await vault.zcashGetAccountMeta({ accountId });
    if (meta) {
      await vault.backgroundApi.simpleDb.privacyChainState.saveZcashAccountMeta(
        {
          accountId,
          meta: { ...meta, birthdayHeight: height },
        },
      );
    }
    // Mutate the in-flight copy too, so this registration already uses the healed value.
    accounts[index].birthdayHeight = height;
  };

  // Lower bound first since it needs no chain tip, so it still heals when the network itself is misbehaving.
  for (let i = 0; i < accounts.length; i += 1) {
    const stored = accounts[i].birthdayHeight;
    if (typeof stored === 'number') {
      const clamped = clampZcashBirthdayHeight({ birthdayHeight: stored });
      if (clamped === stored) {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await persist(i, clamped, 'below-sapling');
    }
  }

  let tip = chainTip ?? undefined;
  if (tip === undefined) {
    try {
      tip = (await vault.getLocalWalletChainTip()) ?? undefined;
    } catch (e) {
      console.log('[zcash] above-tip birthday heal skipped (no chain tip)', {
        ...zcashDescribeError(e),
      });
      return;
    }
  }
  if (typeof tip !== 'number') {
    return;
  }
  for (let i = 0; i < accounts.length; i += 1) {
    const stored = accounts[i].birthdayHeight;
    if (typeof stored === 'number') {
      const clamped = clampZcashBirthdayHeight({
        birthdayHeight: stored,
        chainTip: tip,
      });
      if (clamped === stored) {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await persist(i, clamped, 'above-chain-tip');
    }
  }
}

export async function recoverLocalWalletFromTimeout(
  vault: Vault,
): Promise<boolean> {
  if (platformEnv.isNative) {
    // The WebView is shared across chains (XMR, secret, ...); restart only this Worker before remounting the whole thing.
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        vault.resetLocalWalletCarrier(),
        new Promise<never>((_resolve, reject) => {
          resetTimer = setTimeout(
            () =>
              reject(
                new OneKeyLocalError('zcash: WebEmbed did not answer reset'),
              ),
            ZCASH_WORKER_RESET_TIMEOUT_MS,
          );
        }),
      ]);
      return true;
    } catch (error) {
      console.warn('[zcash] worker reset failed; remounting WebEmbed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(resetTimer);
    }
    const { default: webembedApiProxy } =
      await import('../../../webembeds/instance/webembedApiProxy');
    webembedApiProxy.rejectPendingCalls(
      'zcash: WebEmbed was remounted before this call returned',
    );
    await new Promise<void>((resolve, reject) => {
      const timerRef: {
        current?: ReturnType<typeof setTimeout>;
      } = {};
      const onReady = () => {
        clearTimeout(timerRef.current);
        appEventBus.off(EAppEventBusNames.LoadWebEmbedWebViewComplete, onReady);
        resolve();
      };
      timerRef.current = setTimeout(
        () => {
          appEventBus.off(
            EAppEventBusNames.LoadWebEmbedWebViewComplete,
            onReady,
          );
          reject(
            new OneKeyLocalError(
              'zcash: replacement WebEmbed did not become ready',
            ),
          );
        },
        timerUtils.getTimeDurationMs({ seconds: 45 }),
      );
      appEventBus.on(EAppEventBusNames.LoadWebEmbedWebViewComplete, onReady);
      // The provider changes the component key even when visible, which destroys the old WebView and its wasm execution.
      appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, undefined);
    });
    return true;
  }
  if (platformEnv.isDesktop || platformEnv.isWeb) {
    await vault.resetLocalWalletCarrier();
    return true;
  }
  if (platformEnv.isExtension) {
    await vault.resetLocalWalletCarrier();
    // Probe must not depend on the node being reachable, or an offline moment keeps the chain quarantined all session.
    await timerUtils.wait(250);
    const api = await vault.zcashGetApi();
    await api.capabilities();
    return true;
  }
  return false;
}

export async function prewarmLocalWalletSend(
  vault: Vault,
  {
    accountId,
    sourcePool,
    toAddress,
  }: {
    accountId: string;
    sourcePool: string;
    toAddress: string;
  },
): Promise<void> {
  const privateSource = sourcePool === 'orchard' || sourcePool === 'ironwood';
  const shielding = sourcePool === 'transparent' && toAddress.startsWith('u1');
  if (!privateSource && !shielding) return;
  if (privateSource && !(await vault.zcashPrivacyModeIsActive(accountId)))
    return;
  const chainTip = await fetchZcashChainTipDirect({
    lightwalletdUrl: await vault.zcashResolveLightwalletdUrl(),
  });
  if (chainTip === null) return;
  const api = await vault.zcashGetApi();
  // Only public parameters are prewarmed; the actual send still performs every proof/signature check.
  await api.prewarmPczt({
    network: ZCASH_NETWORK_MAIN,
    targetHeight: chainTip,
  });
}

export async function syncLocalWalletGroup(
  vault: Vault,
  params: {
    accountIds: string[];
    rescanFrom?: { accountId: string; fromHeight: number };
    chainTip?: number | null;
  },
): Promise<{
  synced: boolean;
  stateChanged?: boolean;
  chainTip?: number | null;
  backfillRemaining?: boolean;
}> {
  try {
    return await vault.syncLocalWalletGroupImpl(params);
  } catch (e) {
    if (!isZcashRuntimeDatabaseBroken(e)) {
      throw e;
    }
    console.error('[zcash] runtime database unusable, rebuilding', {
      ...zcashDescribeError(e),
    });
    await vault.zcashRebuildRuntimeDatabase();
    return { synced: false };
  }
}

// Corrupted databases can be rebuilt without reading their transaction
// history. Every account's scanned data goes, so every epoch rotates first.
export async function zcashRebuildRuntimeDatabase(vault: Vault): Promise<void> {
  const stateDb = vault.backgroundApi.simpleDb.privacyChainState;
  await stateDb.rotateAccountEpochs({
    accountIds: await stateDb.listAccountIds({ networkId: vault.networkId }),
  });
  const api = await vault.zcashGetApi();
  await api.dropWalletDatabase(ZCASH_NETWORK_MAIN);
}

export async function zcashPreparePrivacyModeAccount(
  vault: Vault,
  {
    accountId,
    fromHeight,
    birthday,
    onPrepared,
  }: {
    accountId: string;
    fromHeight: number;
    birthday?: IRescanLocalWalletFrom;
    onPrepared: () => Promise<void>;
  },
): Promise<void> {
  const result = await vault.syncLocalWalletGroupImpl({
    accountIds: [accountId],
    rescanFrom: { accountId, fromHeight },
    prepareAccountId: accountId,
    prepareBirthday: birthday,
    onPrepared,
  });
  if (!result.synced) {
    throw new OneKeyLocalError(
      'zcash: privacy runtime registration did not complete',
    );
  }
}

export async function syncLocalWalletGroupImpl(
  vault: Vault,
  {
    chainTip,
    rescanFrom,
    prepareAccountId,
    prepareBirthday,
    onPrepared,
  }: {
    accountIds: string[];
    rescanFrom?: { accountId: string; fromHeight: number };
    chainTip?: number | null;
    prepareAccountId?: string;
    prepareBirthday?: IRescanLocalWalletFrom;
    onPrepared?: () => Promise<void>;
  },
): Promise<{
  synced: boolean;
  stateChanged?: boolean;
  chainTip?: number | null;
  backfillRemaining?: boolean;
}> {
  return getZcashSyncMutex(ZCASH_NETWORK_MAIN).runExclusive(async () => {
    // Enabling only touches the control plane (chain tip, birthday treestate); checked before the runtime loads.
    if (
      prepareAccountId === undefined &&
      !(await vault.backgroundApi.servicePrivacyChain.isLocalWalletScanAllowed())
    ) {
      return { synced: false };
    }
    // Refresh inside the scan lane: queued snapshots can predate another account's enable.
    const { accounts: registered } = await vault.listLocalWalletAccounts();
    const activeAccountIds: string[] = [];
    const activeViewingKeys = new Set<string>();
    const states = new Map<string, IZcashPrivacyModeStateView>();
    const excludedRescans: { accountId: string; fromHeight: number }[] = [];
    for (const candidate of registered) {
      // eslint-disable-next-line no-await-in-loop
      const state =
        await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
          {
            accountId: candidate.accountId,
          },
        );
      states.set(candidate.accountId, state);
      const isPreparing =
        candidate.accountId === prepareAccountId &&
        state.operation?.type === 'enable';
      if (
        candidate.runtimeKey === ZCASH_NETWORK_MAIN &&
        ((candidate.syncEnabled &&
          state.intent === 'on' &&
          state.operation === undefined &&
          // One account whose key can't be read waits for Repair like a
          // hidden one, instead of stopping every other account's scan.
          // eslint-disable-next-line no-await-in-loop
          (await vault.zcashHasAccountViewingKey({
            accountId: candidate.accountId,
            vkFp: candidate.accountRuntimeKey,
          }))) ||
          isPreparing)
      ) {
        activeAccountIds.push(candidate.accountId);
        activeViewingKeys.add(candidate.accountRuntimeKey);
      }
    }
    for (const candidate of registered) {
      if (candidate.runtimeKey !== ZCASH_NETWORK_MAIN) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const state = checkIsDefined(states.get(candidate.accountId));
      // Aliases share scan progress; hiding one must not trigger recovery work while another alias is active.
      if (activeViewingKeys.has(candidate.accountRuntimeKey)) {
        if (state.scanExcludedFromHeight !== undefined) {
          excludedRescans.push({
            accountId: candidate.accountId,
            fromHeight: state.scanExcludedFromHeight,
          });
        }
      } else if (
        state.intent === 'on' &&
        state.operation === undefined &&
        state.scanExcludedFromHeight === undefined
      ) {
        // Persist before another key can consume the shared scan queue; a failed
        // progress read falls back to the birthday, never the tip.
        // eslint-disable-next-line no-await-in-loop
        const progress = await vault.getLocalWalletSyncProgress({
          accountId: candidate.accountId,
        });
        // Persisted key metadata owns the resolved height even when the original enable input was only a timestamp.
        // eslint-disable-next-line no-await-in-loop
        const meta =
          await vault.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta(
            {
              accountId: candidate.accountId,
            },
          );
        const birthdayHeight =
          state.birthdayHeight ??
          meta?.birthdayHeight ??
          progress.birthdayHeight;
        if (birthdayHeight === null || birthdayHeight === undefined) {
          throw new OneKeyLocalError(
            'zcash: hidden account is missing its recovery birthday',
          );
        }
        // eslint-disable-next-line no-await-in-loop
        await vault.backgroundApi.simpleDb.privacyChainState.markZcashScanExcluded(
          {
            accountId: candidate.accountId,
            fromHeight: getPrivacyModeResumeFromHeight({
              progress,
              birthdayHeight,
            }),
          },
        );
      }
    }
    const accountIds = Array.from(new Set(activeAccountIds));
    if (!accountIds.length) {
      return { synced: false };
    }
    // Crash-safety replay first: a birthday change journals before purging,
    // so a death mid-repair is finished here before registration reads it.
    await vault.zcashResumePendingRescans(prepareAccountId);
    let effectiveRescanFrom = rescanFrom;
    if (prepareAccountId !== undefined && prepareBirthday !== undefined) {
      await vault.rescanLocalWallet({
        accountId: prepareAccountId,
        from: prepareBirthday,
      });
      const meta =
        await vault.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta(
          {
            accountId: prepareAccountId,
          },
        );
      effectiveRescanFrom = {
        accountId: prepareAccountId,
        fromHeight: checkIsDefined(meta?.birthdayHeight),
      };
    }
    const accounts = await vault.zcashPrepareAccounts({
      accountIds,
      chainTip,
    });
    // After registration: an account not yet registered (first enable, or just purged) can't be requeued.
    if (effectiveRescanFrom) {
      try {
        await vault.queueLocalWalletRescanFrom(effectiveRescanFrom);
      } catch (error) {
        if (readZcashRuntimeError(error)?.code !== 'NOT_SYNCED') {
          throw error;
        }
      }
    }
    for (const excluded of excludedRescans) {
      // Registration must precede the requeue; a freshly rebuilt runtime has no account range until then.
      // eslint-disable-next-line no-await-in-loop
      await vault.queueLocalWalletRescanFrom(excluded);
    }
    // Enabling establishes viewing state and queues work; only the scheduler may start scanning after admission checks.
    if (prepareAccountId !== undefined) {
      // Registration/requeue and admission must be atomic to other scans; the
      // callback stays in bg and must not reacquire the network mutex.
      await onPrepared?.();
      return { synced: true, backfillRemaining: true };
    }
    // The one metered-data gate: everything past it downloads block data.
    if (
      !(await vault.backgroundApi.servicePrivacyChain.isLocalWalletScanAllowed())
    ) {
      return { synced: false };
    }
    // The shared database trial-decrypts every registered key in one pass, so any account advances the whole group.
    const accountId = accountIds[0];
    const account = await vault.zcashGetWalletAccount({ accountId });
    const api = await vault.zcashGetApi();
    const result = await api.syncWallet(account, {
      activeUfvks: Array.from(new Set(accounts.map((item) => item.ufvk))),
      chainTip,
    });
    for (const excluded of excludedRescans) {
      // A failed/interrupted scan leaves the durable cursor for retry.
      // eslint-disable-next-line no-await-in-loop
      await vault.backgroundApi.simpleDb.privacyChainState.clearZcashScanExcluded(
        {
          accountId: excluded.accountId,
          expectedFromHeight: excluded.fromHeight,
        },
      );
    }
    return {
      synced: true,
      stateChanged: result.stateChanged,
      chainTip: result.chainTip,
      backfillRemaining: result.backfillRemaining,
    };
  });
}

// Drops the scanned data the account shares with its aliases; the next
// sync scans again from the birthday. The caller rotates their epochs.
export async function zcashRewindAccount(
  vault: Vault,
  { accountId }: { accountId: string },
): Promise<void> {
  const account = await vault.zcashGetWalletAccount({ accountId });
  const lifecycleMutex = getZcashAccountLifecycleMutex({
    networkId: vault.networkId,
    ufvk: account.ufvk,
  });
  await lifecycleMutex.runExclusive(async () => {
    const api = await vault.zcashGetApi();
    await api.purgeWallet(account);
  });
}

// Runtime data is keyed by the shared UFVK: another live account holding
// scan data under it keeps it. Funds stay on chain either way; a later
// enable scans them back.
export async function zcashDeleteRuntimeAccount(
  vault: Vault,
  { accountId }: { accountId: string },
): Promise<{ orphaned: boolean }> {
  const stateDb = vault.backgroundApi.simpleDb.privacyChainState;
  const targetMeta = await stateDb.getZcashAccountMeta({ accountId });
  // Setup never stored viewing metadata, so nothing was registered.
  if (!targetMeta) {
    return { orphaned: false };
  }
  return getZcashLifecycleMutex(targetMeta.vkFp).runExclusive(async () => {
    const [metas, metaAccountIds, holders] = await Promise.all([
      stateDb.listZcashAccountMetas({ networkId: vault.networkId }),
      stateDb.listZcashMetaAccountIds({ networkId: vault.networkId }),
      stateDb.listScanDataAccountIds({ networkId: vault.networkId }),
    ]);
    // Unreadable, or a record that may be an alias but can't be read: an
    // alias can't be ruled out, so the data stays for the orphan pass.
    const readableIds = new Set(metas.map((item) => item.accountId));
    if (
      !holders ||
      metaAccountIds.some(
        (id) =>
          id !== accountId && !readableIds.has(id) && holders.includes(id),
      )
    ) {
      return { orphaned: true };
    }
    for (const item of metas) {
      if (
        item.accountId !== accountId &&
        item.meta.vkFp === targetMeta.vkFp &&
        holders.includes(item.accountId) &&
        // eslint-disable-next-line no-await-in-loop
        (await vault.backgroundApi.serviceAccount.getDBAccountSafe({
          accountId: item.accountId,
        }))
      ) {
        return { orphaned: false };
      }
    }
    return purgeZcashRuntimeAccount(vault, accountId);
  });
}

// Retries a shielded-meta derivation that never completed; only call on a full account-bound vault (has a keyring).
export async function zcashRetryLocalWalletSetup(
  vault: Vault,
  {
    password,
    deviceParams,
  }: {
    password?: string;
    deviceParams?: IDeviceSharedCallParams;
  },
): Promise<void> {
  if (vault.keyring instanceof KeyringHardware) {
    await vault.keyring.retryLocalWalletSetup({
      deviceParams: checkIsDefined(deviceParams),
    });
    return;
  }
  await (vault.keyring as KeyringHd).retryLocalWalletSetup({
    password: checkIsDefined(password),
  });
}

export async function zcashTryAutoRepairLocalWalletSetupIfUnlocked(
  vault: Vault,
): Promise<boolean> {
  // A hardware account needs the device in hand; never auto-prompt for it.
  if (vault.keyring instanceof KeyringHardware) {
    return false;
  }
  // Deriving again would only find the same other identity.
  if (zcashIdentityMismatchAccountIds.has(vault.accountId)) {
    return false;
  }
  const hasCachedPassword =
    await vault.backgroundApi.servicePassword.hasCachedPassword();
  if (!hasCachedPassword) {
    return false;
  }
  try {
    // Never prompts: a balance poll must not open a password dialog or bypass 'always re-enter password'.
    if (
      await vault.backgroundApi.servicePassword.isAlwaysReenterPassword(
        EReasonForNeedPassword.CreateTransaction,
      )
    ) {
      return false;
    }
    const password =
      await vault.backgroundApi.servicePassword.getCachedPassword();
    if (!password) return false;
    await vault.zcashRetryLocalWalletSetup({ password });
    return true;
  } catch (e) {
    console.error('[zcash] auto repair local wallet setup failed', {
      accountId: vault.accountId,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

// Powers the sync-progress display by reading the wallet summary only; polling must never enqueue or join a scan job.
export async function getLocalWalletSyncProgress(
  vault: Vault,
  {
    accountId,
  }: {
    accountId: string;
  },
): Promise<IZcashSyncProgress> {
  try {
    if (!(await vault.zcashPrivacyModeIsActive(accountId))) {
      throw createZcashSetupIncompleteError();
    }
    const account = await vault.zcashGetWalletAccount({ accountId });
    const api = await vault.zcashGetApi();
    return await api.getSyncProgress(account);
  } catch (e) {
    console.log('[zcash] getLocalWalletSyncProgress failed', {
      accountId,
      ...zcashDescribeError(e),
    });
    return {
      birthdayHeight: null,
      backfillScannedHeight: null,
      backfillTargetHeight: null,
      backfillProgress: null,
      isBackfillComplete: false,
      tipScannedHeight: null,
      chainTip: null,
      tipLag: null,
      isTipCaughtUp: false,
      isSyncing: false,
    };
  }
}

export async function applyPendingRescan(
  vault: Vault,
  {
    accountId,
    repair,
  }: {
    accountId: string;
    repair: IZcashPendingRescan;
  },
): Promise<void> {
  const meta = await vault.zcashGetAccountMeta({ accountId });
  if (!meta) {
    await vault.backgroundApi.simpleDb.privacyChainState.removeZcashPendingRescan(
      {
        accountId,
        expectedRepair: repair,
      },
    );
    return;
  }
  const lifecycleMutex = getZcashLifecycleMutex(meta.vkFp);
  await lifecycleMutex.runExclusive(async () => {
    const [currentMeta, pendingRescans, owner] = await Promise.all([
      vault.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
        accountId,
      }),
      vault.backgroundApi.simpleDb.privacyChainState.listZcashPendingRescans({
        networkId: vault.networkId,
      }),
      vault.backgroundApi.serviceAccount.getDBAccountSafe({ accountId }),
    ]);
    const pending = pendingRescans.find(
      (candidate) => candidate.accountId === accountId,
    )?.repair;
    if (
      !owner ||
      !currentMeta ||
      currentMeta.vkFp !== meta.vkFp ||
      !isSameZcashPendingRescan(pending, repair)
    ) {
      return;
    }
    // Save the corrected birthday BEFORE purging: purging first could wedge
    // the account if the stored birthday never resolves. Crash-safe via the journal.
    await vault.backgroundApi.simpleDb.privacyChainState.saveZcashAccountMeta({
      accountId,
      expectedMeta: currentMeta,
      meta: {
        ...currentMeta,
        birthdayHeight: repair.birthdayHeight,
        birthdaySource: repair.birthdaySource,
        birthdayTimestamp: repair.birthdayTimestamp,
      },
    });
    const account = await vault.zcashGetWalletAccount({ accountId });
    // Aliases share the scanned data this purges.
    await vault.backgroundApi.simpleDb.privacyChainState.rotateAccountEpochs({
      accountIds: await vault.getLocalWalletAccountAliases({ accountId }),
    });
    const api = await vault.zcashGetApi();
    await api.purgeWallet(account);
    await vault.backgroundApi.simpleDb.privacyChainState.removeZcashPendingRescan(
      {
        accountId,
        expectedRepair: repair,
      },
    );
  });
}

// Crash-safety replay for recorded birthday repairs; runs at the start of every sync turn (cheap when empty).
export async function zcashResumePendingRescans(
  vault: Vault,
  requiredAccountId?: string,
): Promise<void> {
  const repairs =
    await vault.backgroundApi.simpleDb.privacyChainState.listZcashPendingRescans(
      {
        networkId: vault.networkId,
      },
    );
  for (const { accountId, repair } of repairs) {
    // eslint-disable-next-line no-await-in-loop
    const owner = await vault.backgroundApi.serviceAccount.getDBAccountSafe({
      accountId,
    });
    if (!owner) {
      // eslint-disable-next-line no-await-in-loop
      await vault.backgroundApi.simpleDb.privacyChainState.removeZcashPendingRescan(
        {
          accountId,
        },
      );
      // eslint-disable-next-line no-continue
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await vault.applyPendingRescan({ accountId, repair });
    } catch (e) {
      if (accountId === requiredAccountId) {
        // Admission cannot finish while this identity's recovery is pending.
        throw e;
      }
      // Keep the journal intact; a later scheduler tick can retry without the user reopening the repair dialog.
      console.error('[zcash] pending rescan resume failed', {
        accountId,
        ...zcashDescribeError(e),
      });
    }
  }
}

// Shared primitive behind every birthday-repair entry point: the journal
// is written before the cache purge so a crash can't half-apply a birthday.
export async function zcashRescanFromHeight(
  vault: Vault,
  {
    accountId,
    birthdayHeight,
    birthdaySource,
    birthdayTimestamp,
  }: {
    accountId: string;
    birthdayHeight: number;
    birthdaySource: IZcashBirthdaySource;
    birthdayTimestamp?: number;
  },
): Promise<void> {
  const meta = await vault.zcashGetAccountMeta({ accountId });
  if (!meta) {
    throw new OneKeyLocalError(
      'zcash: no local wallet meta to rescan (run retryLocalWalletSetup first)',
    );
  }
  // The normal sync heals out-of-range birthdays against its fresh chain tip.
  const effectiveHeight = clampZcashBirthdayHeight({ birthdayHeight });
  const repair: IZcashPendingRescan = {
    birthdayHeight: effectiveHeight,
    birthdaySource,
    birthdayTimestamp,
    requestedAt: Date.now(),
  };
  await vault.backgroundApi.simpleDb.privacyChainState.saveZcashPendingRescan({
    accountId,
    repair,
  });
  await vault.applyPendingRescan({ accountId, repair });
}

// Resolves the scan start from whichever form the caller gives, then clamps/persists/applies it.
export async function rescanLocalWallet(
  vault: Vault,
  {
    accountId,
    from,
    dryRun,
  }: {
    accountId: string;
    from: IRescanLocalWalletFrom;
    dryRun?: boolean;
  },
): Promise<{ fromHeight: number }> {
  let birthdayHeight: number;
  let birthdaySource: IZcashBirthdaySource = 'manual-height';
  let birthdayTimestamp: number | undefined;
  if (from.type === 'height') {
    birthdayHeight = from.height;
  } else {
    birthdayTimestamp =
      from.type === 'timestamp'
        ? from.timestamp
        : Date.now() - Math.max(0, from.daysAgo) * 24 * 60 * 60 * 1000;
    birthdaySource = 'manual-month';
    const tip = await getLastLocalWalletChainTip({
      backgroundApi: vault.backgroundApi,
      networkId: vault.networkId,
    }).catch(() => undefined);
    birthdayHeight = estimateZcashBirthdayHeight({
      birthdayTimestamp,
      now: Date.now(),
      chainTip: tip,
    });
  }
  if (!dryRun) {
    await vault.zcashRescanFromHeight({
      accountId,
      birthdayHeight,
      birthdaySource,
      birthdayTimestamp,
    });
  }
  return { fromHeight: birthdayHeight };
}
