import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// What a privacy chain's scan last produced, kept on disk so a cold start or
// a busy scanner shows it (as not yet current) instead of a blank: each
// account's private balance (the chain owns its shape) and each network's
// chain tip. Balance lifecycle (delete, rescan, reset) is ServicePrivacyChain's
// job; pausing keeps it, like the scan data.

// How long a balance shown on a page waits for the scanner before the saved
// value is shown instead.
export const LOCAL_WALLET_DISPLAY_WAIT_MS = 1000;

export type ILocalWalletBalanceRead<T> = {
  value: T;
  // Saved earlier, not read from the scanner just now.
  stale: boolean;
};

async function readSaved({
  backgroundApi,
  networkId,
  accountId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
}): Promise<string | undefined> {
  const record = await backgroundApi.simpleDb.privacyChainCache.getLastBalance({
    accountId,
  });
  return record?.networkId === networkId ? record.value : undefined;
}

async function save({
  backgroundApi,
  networkId,
  accountId,
  serialized,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  serialized: string;
}): Promise<void> {
  if (
    (await readSaved({ backgroundApi, networkId, accountId })) === serialized
  ) {
    return;
  }
  await backgroundApi.simpleDb.privacyChainCache.setLastBalance({
    accountId,
    record: { networkId, value: serialized, savedAt: Date.now() },
  });
}

// For a scanner that holds the runtime for long turns: it saves what it just
// read, so pages answering from disk during the turn are not left behind.
export async function saveLastLocalWalletBalance<T>({
  backgroundApi,
  networkId,
  accountId,
  value,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  value: T;
}): Promise<void> {
  await save({
    backgroundApi,
    networkId,
    accountId,
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
  const saved = await readSaved({ backgroundApi, networkId, accountId });
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
// breaks on it.
export async function readLastLocalWalletPublicBalance({
  backgroundApi,
  networkId,
  accountId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
}): Promise<ILocalWalletLastPublicBalance | undefined> {
  try {
    const record =
      await backgroundApi.simpleDb.privacyChainCache.getLastPublicBalance({
        accountId,
      });
    return record?.networkId === networkId
      ? { total: record.total, spendable: record.spendable }
      : undefined;
  } catch {
    return undefined;
  }
}

export async function saveLastLocalWalletPublicBalance({
  backgroundApi,
  networkId,
  accountId,
  value,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  value: ILocalWalletLastPublicBalance;
}): Promise<void> {
  try {
    const saved = await readLastLocalWalletPublicBalance({
      backgroundApi,
      networkId,
      accountId,
    });
    if (saved?.total === value.total && saved.spendable === value.spendable) {
      return;
    }
    await backgroundApi.simpleDb.privacyChainCache.setLastPublicBalance({
      accountId,
      record: { networkId, ...value, savedAt: Date.now() },
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

export async function listLastLocalWalletBalanceAccountIds({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApi;
}): Promise<string[]> {
  return backgroundApi.simpleDb.privacyChainCache.listLastBalanceAccountIds();
}

// For display only (progress, unlock state); anything acting on the tip
// fetches it from the node.
export async function getLastLocalWalletChainTip({
  backgroundApi,
  networkId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
}): Promise<number | undefined> {
  return backgroundApi.simpleDb.privacyChainCache.getChainTip({ networkId });
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
