import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// The last scanned private balance per account and chain tip per network, so a
// cold start or busy scanner shows it (as not current) instead of a blank.
// ServicePrivacyChain owns the balance lifecycle; pausing keeps it.

// How long a balance shown on a page waits for the scanner before the saved
// value is shown instead.
export const LOCAL_WALLET_DISPLAY_WAIT_MS = 1000;

export type ILocalWalletBalanceRead<T> = {
  value: T;
  // Saved earlier, not read from the scanner just now.
  stale: boolean;
};

// The account's epoch now (see privacyChainState). A value is saved only
// under the epoch read before it was fetched, and read back only under the
// current one.
export async function readLocalWalletCacheEpoch({
  backgroundApi,
  accountId,
}: {
  backgroundApi: IBackgroundApi;
  accountId: string;
}): Promise<string | undefined> {
  return backgroundApi.simpleDb.privacyChainState.getAccountEpoch({
    accountId,
  });
}

export async function isLocalWalletCacheEpochCurrent({
  backgroundApi,
  accountId,
  epoch,
}: {
  backgroundApi: IBackgroundApi;
  accountId: string;
  epoch: string | undefined;
}): Promise<boolean> {
  return (
    (await readLocalWalletCacheEpoch({ backgroundApi, accountId })) === epoch
  );
}

// Best-effort: a stale entry left behind is still ignored by the next read.
function removeStale({
  backgroundApi,
  kind,
  accountId,
  epoch,
}: {
  backgroundApi: IBackgroundApi;
  kind: 'lastBalances' | 'lastPublicBalances';
  accountId: string;
  epoch: string | undefined;
}) {
  void backgroundApi.simpleDb.privacyChainCache
    .removeStaleBalance({ kind, accountId, epoch })
    .catch(() => undefined);
}

async function readSaved({
  backgroundApi,
  networkId,
  accountId,
  epoch,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  epoch: string | undefined;
}): Promise<string | undefined> {
  const record = await backgroundApi.simpleDb.privacyChainCache.getLastBalance({
    accountId,
  });
  if (record?.networkId !== networkId) return undefined;
  // Written for scanned data that has since been destroyed.
  if (record.epoch !== epoch) {
    removeStale({
      backgroundApi,
      kind: 'lastBalances',
      accountId,
      epoch: record.epoch,
    });
    return undefined;
  }
  return record.value;
}

async function save({
  backgroundApi,
  networkId,
  accountId,
  epoch,
  serialized,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  epoch: string | undefined;
  serialized: string;
}): Promise<void> {
  if (
    (await readSaved({ backgroundApi, networkId, accountId, epoch })) ===
    serialized
  ) {
    return;
  }
  await backgroundApi.simpleDb.privacyChainCache.setLastBalance({
    accountId,
    record: { networkId, epoch, value: serialized, savedAt: Date.now() },
    isCurrent: () =>
      isLocalWalletCacheEpochCurrent({ backgroundApi, accountId, epoch }),
  });
}

// For a scanner that holds the runtime for long turns: it saves what it just
// read, so pages answering from disk during the turn are not left behind.
// `epoch` is the account's epoch from before the value was read.
export async function saveLastLocalWalletBalance<T>({
  backgroundApi,
  networkId,
  accountId,
  epoch,
  value,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  epoch: string | undefined;
  value: T;
}): Promise<void> {
  await save({
    backgroundApi,
    networkId,
    accountId,
    epoch,
    serialized: JSON.stringify(value),
  });
}

// `read` resolves null when the account authoritatively has no private
// balance (not scanning, never synced): that is passed through, never
// replaced by a saved value. A throw is a failed read and falls back to it.
export async function readLocalWalletBalanceStaleFirst<T>({
  backgroundApi,
  networkId,
  accountId,
  read,
  liveWaitMs,
  skipLive = false,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  read: () => Promise<T | null>;
  // Display reads only. Absent: wait for the scanner however long it takes.
  liveWaitMs?: number;
  // The scanner is busy; answer from disk without queueing behind it.
  skipLive?: boolean;
}): Promise<ILocalWalletBalanceRead<T> | null> {
  // Taken before the live read starts, so its write-back can tell whether
  // the data it read was destroyed meanwhile.
  const epoch = await readLocalWalletCacheEpoch({ backgroundApi, accountId });
  const saved = await readSaved({ backgroundApi, networkId, accountId, epoch });
  const savedRead =
    saved === undefined
      ? null
      : { value: JSON.parse(saved) as T, stale: true as const };
  if (skipLive) return savedRead;

  const live = (async () => {
    const value = await read();
    if (value !== null) {
      await save({
        backgroundApi,
        networkId,
        accountId,
        epoch,
        serialized: JSON.stringify(value),
      });
    }
    return value;
  })();

  if (!savedRead) {
    const value = await live;
    return value === null ? null : { value, stale: false };
  }

  const settled = live.then(
    (value) => ({ settled: true as const, failed: false, value }),
    () => ({ settled: true as const, failed: true, value: null }),
  );
  const outcome =
    liveWaitMs === undefined
      ? await settled
      : await Promise.race([
          settled,
          timerUtils.wait(liveWaitMs).then(() => ({ settled: false as const })),
        ]);
  if (outcome.settled) {
    if (outcome.failed) return savedRead;
    return outcome.value === null
      ? null
      : { value: outcome.value, stale: false };
  }
  // Too slow for this page; lists refetch once the live value lands.
  void settled.then(({ failed, value }) => {
    if (!failed && value !== null && JSON.stringify(value) !== saved) {
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
      appEventBus.emit(EAppEventBusNames.LocalWalletBalanceLanded, {
        networkId,
        accountId,
      });
    }
  });
  return savedRead;
}

// The public side's last backend figures (base units), for display only.
export type ILocalWalletLastPublicBalance = {
  total: string;
  spendable: string;
};

// A cache miss or a failing store reads as nothing saved; display never
// breaks on it. A pair saved before the account had a state record carries
// no epoch: backend figures, and every destruction deletes them anyway.
export async function readLastLocalWalletPublicBalance({
  backgroundApi,
  networkId,
  accountId,
  epoch,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  epoch: string | undefined;
}): Promise<ILocalWalletLastPublicBalance | undefined> {
  try {
    const record =
      await backgroundApi.simpleDb.privacyChainCache.getLastPublicBalance({
        accountId,
      });
    if (record?.networkId !== networkId) return undefined;
    if (record.epoch !== undefined && record.epoch !== epoch) {
      removeStale({
        backgroundApi,
        kind: 'lastPublicBalances',
        accountId,
        epoch: record.epoch,
      });
      return undefined;
    }
    return { total: record.total, spendable: record.spendable };
  } catch {
    return undefined;
  }
}

// `epoch` is the account's epoch from before the value was fetched.
export async function saveLastLocalWalletPublicBalance({
  backgroundApi,
  networkId,
  accountId,
  epoch,
  value,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  epoch: string | undefined;
  value: ILocalWalletLastPublicBalance;
}): Promise<void> {
  try {
    const saved = await readLastLocalWalletPublicBalance({
      backgroundApi,
      networkId,
      accountId,
      epoch,
    });
    if (saved?.total === value.total && saved.spendable === value.spendable) {
      return;
    }
    await backgroundApi.simpleDb.privacyChainCache.setLastPublicBalance({
      accountId,
      record: { networkId, epoch, ...value, savedAt: Date.now() },
      isCurrent: () =>
        isLocalWalletCacheEpochCurrent({ backgroundApi, accountId, epoch }),
    });
  } catch (e) {
    console.error('[privacyChain] save last public balance failed', e);
  }
}

// Clears the saved public balance too.
export async function removeLastLocalWalletBalances({
  backgroundApi,
  accountIds,
}: {
  backgroundApi: IBackgroundApi;
  accountIds: string[];
}): Promise<void> {
  if (accountIds.length === 0) return;
  await backgroundApi.simpleDb.privacyChainCache.removeLastBalances({
    accountIds,
  });
}

export async function removeNetworkLastLocalWalletBalances({
  backgroundApi,
  networkId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
}): Promise<void> {
  await backgroundApi.simpleDb.privacyChainCache.removeNetworkLastBalances({
    networkId,
  });
}

export async function clearLocalWalletBalances({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  await backgroundApi.simpleDb.privacyChainCache.clearBalances();
}

export async function listLastLocalWalletBalanceAccountIds({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApi;
}): Promise<string[]> {
  return backgroundApi.simpleDb.privacyChainCache.listLastBalanceAccountIds();
}

// Last observed tip for display and local scan-data management. Sending and
// normal sync fetch their current chain data from the node.
export async function getLastLocalWalletChainTip({
  backgroundApi,
  networkId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
}): Promise<number | undefined> {
  return backgroundApi.simpleDb.privacyChainCache.getChainTip({ networkId });
}

export async function removeLastLocalWalletChainTips({
  backgroundApi,
  networkId,
}: {
  backgroundApi: IBackgroundApi;
  networkId?: string;
}): Promise<void> {
  await backgroundApi.simpleDb.privacyChainCache.removeChainTips({
    networkId,
  });
}

export async function saveLastLocalWalletChainTip({
  backgroundApi,
  networkId,
  height,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  height: number;
}): Promise<void> {
  const saved = await backgroundApi.simpleDb.privacyChainCache.getChainTip({
    networkId,
  });
  if (saved === height) return;
  await backgroundApi.simpleDb.privacyChainCache.setChainTip({
    networkId,
    height,
  });
}
