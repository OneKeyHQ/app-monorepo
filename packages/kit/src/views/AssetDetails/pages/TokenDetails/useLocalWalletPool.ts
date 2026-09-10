import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEqual } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  privacyChainPoolOwnerKey,
  usePrivacyChainPoolDisplayAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool';
import type {
  ILocalWalletAccountBalance,
  ILocalWalletPoolBalance,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  PRIVACY_CHAIN_SYNC_POLL_MS,
  isTipLagWorthMentioning,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

type ILocalWalletSettings = NonNullable<IVaultSettings['localWallet']>;

const num = (v: number) => v.toLocaleString('en-US');

function formatEtaSuffix(
  remainingBlocks: number,
  blocksPerSec: number | null,
): string {
  if (!blocksPerSec || blocksPerSec <= 0 || remainingBlocks <= 0) return '';
  const seconds = remainingBlocks / blocksPerSec;
  if (seconds < 90) return ' · ~1 min';
  const minutes = seconds / 60;
  if (minutes < 90) return ` · ~${Math.ceil(minutes)} min`;
  return ` · ~${(minutes / 60).toFixed(1)} h`;
}

function formatBehind(lagBlocks: number, blockTimeSeconds: number): string {
  const minutes = (lagBlocks * blockTimeSeconds) / 60;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min behind`;
  return `${(minutes / 60).toFixed(1)} h behind`;
}

export function buildLocalWalletSyncStatusText({
  syncProgress,
  settings,
  scanRatePerSec,
}: {
  syncProgress: ILocalWalletSyncProgress | null | undefined;
  settings: ILocalWalletSettings | undefined;
  scanRatePerSec: number | null;
}): string | null {
  if (!syncProgress) return null;
  const heightsPresent = [
    syncProgress.backfillScannedHeight,
    syncProgress.backfillTargetHeight,
    syncProgress.tipScannedHeight,
    syncProgress.chainTip,
  ].some((height) => typeof height === 'number');
  if (!heightsPresent) return null;

  if (!syncProgress.isBackfillComplete) {
    const scanned = syncProgress.backfillScannedHeight;
    const target = syncProgress.backfillTargetHeight;
    const hasHeights =
      typeof scanned === 'number' && typeof target === 'number';
    const pct =
      syncProgress.backfillProgress === null
        ? ''
        : `${Math.floor(syncProgress.backfillProgress * 100)}% · `;
    const heights = hasHeights ? `${num(scanned)} / ${num(target)}` : '';
    const remaining = hasHeights ? Math.max(0, target - scanned) : 0;
    const region =
      typeof scanned === 'number'
        ? settings?.scanRegionHints?.find(
            (hint) => scanned >= hint.fromHeight && scanned <= hint.toHeight,
          )
        : undefined;
    const regionText = region ? ` · ${region.label}` : '';
    return `${pct}${heights}${regionText}${formatEtaSuffix(
      remaining,
      scanRatePerSec,
    )}`;
  }
  const at = syncProgress.tipScannedHeight;
  const tip = syncProgress.chainTip;
  const heights =
    typeof at === 'number' && typeof tip === 'number'
      ? `${num(at)} / ${num(tip)}`
      : '';
  const lag = syncProgress.tipLag;
  const behind =
    isTipLagWorthMentioning(
      lag,
      settings?.tipLagWarningBlocks ?? Number.MAX_SAFE_INTEGER,
    ) && settings
      ? ` · ${formatBehind(lag ?? 0, settings.blockTimeSeconds)}`
      : '';
  return heights ? `${heights}${behind}` : 'Synced';
}

// Everything the token page and the account settings page need for one
// local-wallet account, optionally focused on one pool. Chain-agnostic: it
// reads settings.localWallet and servicePrivacyChain only. Publishes the
// selected pool's balance/address/action to the pool store the header reads.
export function useLocalWalletPool({
  networkId,
  accountId,
  poolId,
  isActive = true,
}: {
  networkId: string;
  accountId: string;
  poolId?: number;
  isActive?: boolean;
}) {
  const [, setPoolDisplay] = usePrivacyChainPoolDisplayAtom();
  const [busy, setBusy] = useState(false);
  const [hasAttemptedBalance, setHasAttemptedBalance] = useState(false);

  const { account, vaultSettings } = useAccountData({ networkId, accountId });
  const settings = vaultSettings?.localWallet;
  const hasPooledBalance = settings?.balanceShape === 'pooled';
  const pool = useMemo(
    () => settings?.pools.find((item) => item.id === poolId),
    [poolId, settings?.pools],
  );

  const { result: state, run: refreshState } = usePromiseResult(
    async () => {
      if (!isActive || !hasPooledBalance || !accountId) return undefined;
      return backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState({
        networkId,
        accountId,
      });
    },
    [isActive, hasPooledBalance, networkId, accountId],
    { overrideIsFocused: (isPageFocused) => isPageFocused && isActive },
  );
  const enabled = state?.enabled === true;
  const canRead = isActive && hasPooledBalance && !!accountId && enabled;

  const { result: balance, run: refreshBalance } = usePromiseResult(
    async (): Promise<ILocalWalletAccountBalance | null> => {
      if (!canRead) return null;
      try {
        return await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountBalance(
          { networkId, accountId },
        );
      } finally {
        setHasAttemptedBalance(true);
      }
    },
    [canRead, networkId, accountId],
    {
      pollingInterval: canRead ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );

  const { result: addresses, run: refreshAddresses } = usePromiseResult(
    async () => {
      if (!canRead) return null;
      const result =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountAddresses(
          { networkId, accountId },
        );
      return result ?? null;
    },
    [canRead, networkId, accountId],
    { overrideIsFocused: (isPageFocused) => isPageFocused && isActive },
  );

  // Scan speed observed between polls, for the ETA. Refs on purpose: they
  // only feed a label derived at render time and must not cause renders.
  const scanRateSampleRef = useRef<{ height: number; at: number } | null>(null);
  const scanRatePerSecRef = useRef<number | null>(null);
  const { result: syncProgress, run: refreshSyncProgress } = usePromiseResult(
    async () => {
      if (!canRead) return null;
      const progress =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletSyncProgress(
          { networkId, accountId },
        );
      const scanned = progress?.backfillScannedHeight;
      if (typeof scanned === 'number') {
        const now = Date.now();
        const prev = scanRateSampleRef.current;
        if (!prev || scanned < prev.height) {
          scanRatePerSecRef.current = null;
          scanRateSampleRef.current = { height: scanned, at: now };
        } else if (scanned > prev.height && now > prev.at) {
          const instantaneous =
            ((scanned - prev.height) * 1000) / (now - prev.at);
          const ema = scanRatePerSecRef.current;
          scanRatePerSecRef.current =
            ema === null ? instantaneous : ema * 0.7 + instantaneous * 0.3;
          scanRateSampleRef.current = { height: scanned, at: now };
        }
      }
      return progress;
    },
    [canRead, networkId, accountId],
    {
      pollingInterval: canRead ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );

  const refresh = useCallback(() => {
    void refreshState();
    void refreshBalance();
    void refreshAddresses();
    void refreshSyncProgress();
  }, [refreshAddresses, refreshBalance, refreshState, refreshSyncProgress]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const handleActionDone = useCallback(() => {
    refreshRef.current();
  }, []);

  const identityRef = useRef(`${networkId}:${accountId}`);
  useEffect(() => {
    const identity = `${networkId}:${accountId}`;
    if (identityRef.current === identity) return;
    identityRef.current = identity;
    setHasAttemptedBalance(false);
    scanRateSampleRef.current = null;
    scanRatePerSecRef.current = null;
    setPoolDisplay(undefined);
  }, [accountId, networkId, setPoolDisplay]);

  const poolBalance: ILocalWalletPoolBalance | undefined = useMemo(
    () => balance?.pools.find((item) => item.key === pool?.key),
    [balance?.pools, pool?.key],
  );
  const poolAddress = useMemo(() => {
    if (!pool) return undefined;
    if (pool.kind === 'public') return addresses?.publicAddress;
    // A legacy pool has nowhere to receive; offering an address would invite
    // value into a pool the chain no longer accepts.
    return pool.receivesFunds === false ? undefined : addresses?.privateAddress;
  }, [addresses, pool]);

  useEffect(() => {
    if (!isActive || !enabled || !pool) return;
    const move = poolBalance?.move;
    const next = {
      ownerKey: privacyChainPoolOwnerKey({ accountId, networkId, poolId }),
      address: poolAddress,
      balanceParsed: balance ? (poolBalance?.totalParsed ?? '0') : undefined,
      balanceSettled: hasAttemptedBalance,
      action: move
        ? {
            type: move.type,
            fromAddress: account?.address ?? '',
            toAddress:
              move.type === 'shield'
                ? addresses?.privateAddress
                : addresses?.publicAddress,
            amount: move.amountParsed,
            spendSource: move.type === 'withdraw' ? pool.key : undefined,
            disabled: !balance || !move.enabled,
            onDone: handleActionDone,
          }
        : undefined,
    };
    setPoolDisplay((prev) => (isEqual(prev, next) ? prev : next));
  }, [
    account?.address,
    accountId,
    addresses,
    balance,
    enabled,
    handleActionDone,
    hasAttemptedBalance,
    isActive,
    networkId,
    pool,
    poolAddress,
    poolBalance,
    poolId,
    setPoolDisplay,
  ]);

  useEffect(() => {
    if (!enabled) {
      setPoolDisplay(undefined);
    }
  }, [enabled, setPoolDisplay]);

  const syncStatusText = buildLocalWalletSyncStatusText({
    syncProgress,
    settings,
    scanRatePerSec: scanRatePerSecRef.current,
  });

  const runBusy = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const enableAccount = useCallback(
    (params: { birthdayHeight?: number; birthdayTimestamp?: number }) =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount({
          networkId,
          accountId,
          ...params,
        });
        refreshRef.current();
      }),
    [accountId, networkId, runBusy],
  );
  const disableAccount = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.disableLocalWalletAccount({
          networkId,
          accountId,
        });
        setPoolDisplay(undefined);
        setHasAttemptedBalance(false);
        void refreshState();
      }),
    [accountId, networkId, refreshState, runBusy, setPoolDisplay],
  );
  const setPreferPublicSends = useCallback(
    (preferPublic: boolean) =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.setLocalWalletAccountSendPreference(
          { networkId, accountId, preferPublic },
        );
        await refreshState();
      }),
    [accountId, networkId, refreshState, runBusy],
  );
  const resetLocalData = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.resetLocalChainData({
          networkId,
          accountId,
        });
        refreshRef.current();
      }),
    [accountId, networkId, runBusy],
  );
  const deleteLocalData = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.deleteLocalWalletAccountData(
          { networkId, accountId },
        );
        setPoolDisplay(undefined);
        setHasAttemptedBalance(false);
        void refreshState();
      }),
    [accountId, networkId, refreshState, runBusy, setPoolDisplay],
  );
  const startSync = useCallback(() => {
    void backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
      networkId,
      accountId,
      trigger: 'manual-sync',
    });
    refreshRef.current();
  }, [accountId, networkId]);

  return {
    settings,
    hasPooledBalance,
    pool,
    state,
    // Undefined until the first state read lands; consumers must not treat
    // it as "disabled" before that.
    isStateSettled: state !== undefined,
    enabled,
    balance,
    poolBalance,
    poolAddress,
    addresses,
    syncProgress,
    syncStatusText,
    hasAttemptedBalance,
    busy,
    accountName: account?.name,
    refresh,
    startSync,
    enableAccount,
    disableAccount,
    setPreferPublicSends,
    resetLocalData,
    deleteLocalData,
  };
}

export type ILocalWalletPool = ReturnType<typeof useLocalWalletPool>;
