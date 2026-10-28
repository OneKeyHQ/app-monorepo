import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  privacyChainPoolOwnerKey,
  usePrivacyChainPoolDisplayAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool';
import {
  formatPrivacyChainSyncDetail,
  formatPrivacyChainSyncError,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountState,
  ILocalWalletPoolBalance,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getLocalWalletPoolDisplayAddress } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import {
  PRIVACY_CHAIN_SYNC_POLL_MS,
  PRIVACY_CHAIN_TIP_POLL_MS,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

type ILocalWalletSettings = NonNullable<IVaultSettings['localWallet']>;

// Last state/addresses seen per account, in memory only; reopening the page shows them at once.
const lastSeenByAccount = new Map<
  string,
  {
    state?: ILocalWalletAccountState;
    addresses?: ILocalWalletAccountAddresses | null;
  }
>();

export function resetLocalWalletPoolLastSeen() {
  lastSeenByAccount.clear();
}
type ILocalWalletReadScope = {
  accountScope: { networkId: string; accountId: string; revision: number };
};

// Which pool the token page is showing. A single-balance chain (Monero) has one pool and no
// tabs to select it, so it defaults to its default-private pool instead.
export function resolveSelectedPoolId({
  settings,
  selectedPoolId,
}: {
  settings: ILocalWalletSettings | undefined;
  selectedPoolId: number | undefined;
}): number | undefined {
  if (selectedPoolId !== undefined) return selectedPoolId;
  if (settings?.balanceShape !== 'single') return undefined;
  const pool =
    settings.pools.find((item) => item.isDefaultPrivate) ?? settings.pools[0];
  return pool?.id;
}

// Everything the token/settings pages need for one local-wallet account, optionally for one pool.
export function useLocalWalletPool({
  networkId,
  accountId,
  poolId,
  isActive = true,
  accountData,
}: {
  networkId: string;
  accountId: string;
  poolId?: number;
  isActive?: boolean;
  // Already loaded by the caller for this account and network; skips a
  // second useAccountData round of background calls per mounted tab.
  accountData?: {
    account: INetworkAccount | undefined;
    vaultSettings: IVaultSettings | undefined;
  };
}) {
  const intl = useIntl();
  const [, setPoolDisplay] = usePrivacyChainPoolDisplayAtom();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [attemptedBalanceScope, setAttemptedBalanceScope] =
    useState<ILocalWalletReadScope>();
  const accountScope = useMemo(
    () => ({ networkId, accountId, revision }),
    [networkId, accountId, revision],
  );

  const ownAccountData = useAccountData(
    accountData ? {} : { networkId, accountId },
  );
  const { account, vaultSettings } = accountData ?? ownAccountData;
  const settings = vaultSettings?.localWallet;
  const hasPooledBalance = Boolean(settings);
  const pool = useMemo(
    () => settings?.pools.find((item) => item.id === poolId),
    [poolId, settings?.pools],
  );

  // Read from the chain rather than inferred from the account id: Monero has no hardware
  // keyring, so a hardware account there can never scan despite looking scannable.
  const { result: accountSupport } = usePromiseResult(
    async () => {
      if (!hasPooledBalance || !accountId) return undefined;
      return backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountSupport(
        { networkId, accountId },
      );
    },
    [hasPooledBalance, accountId, networkId],
    { undefinedResultIfReRun: true },
  );
  const isWalletSupported =
    accountSupport === undefined ? undefined : accountSupport === 'supported';
  const isUnsupportedWallet = isWalletSupported === false;

  // Privacy settings open in a retained modal, so invalidate on this event even without a focus change.
  useEffect(() => {
    if (!hasPooledBalance) return;
    const invalidate = (payload: {
      networkId: string;
      accountIds: string[];
    }) => {
      if (
        payload.networkId !== networkId ||
        !payload.accountIds.includes(accountId)
      ) {
        return;
      }
      const ownerKey = privacyChainPoolOwnerKey({
        accountId,
        networkId,
        poolId,
      });
      setPoolDisplay((prev) =>
        prev?.ownerKey === ownerKey ? undefined : prev,
      );
      lastSeenByAccount.delete(`${networkId}:${accountId}`);
      setRevision((value) => value + 1);
    };
    appEventBus.on(EAppEventBusNames.LocalWalletAccountsChanged, invalidate);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalWalletAccountsChanged, invalidate);
    };
  }, [accountId, hasPooledBalance, networkId, poolId, setPoolDisplay]);

  const { result: stateResult, run: refreshState } = usePromiseResult(
    async () => {
      if (!isActive || !hasPooledBalance || !accountId) return undefined;
      try {
        return {
          scope: accountScope,
          state:
            await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
              { networkId, accountId },
            ),
        };
      } catch (error) {
        // Fail closed: an unknown state must not fall back to a remembered one.
        lastSeenByAccount.delete(`${networkId}:${accountId}`);
        throw error;
      }
    },
    [isActive, hasPooledBalance, accountScope, accountId, networkId],
    {
      revalidateOnFocus: true,
      undefinedResultIfError: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const lastSeenKey = `${networkId}:${accountId}`;
  const lastSeen = lastSeenByAccount.get(lastSeenKey);
  const freshState =
    stateResult?.scope === accountScope ? stateResult.state : undefined;
  const state = freshState ?? lastSeen?.state;
  const accountPaused = state?.paused === true;
  const enabled = state?.enabled === true || accountPaused;
  const canRead =
    isActive && hasPooledBalance && !!accountId && enabled && !accountPaused;
  const canReadBalance =
    isActive &&
    hasPooledBalance &&
    !!accountId &&
    (enabled || pool?.source === 'backend');
  // Scope follows accountScope only, so a tab switch keeps what is already on screen.
  const readScope = useMemo(() => ({ accountScope }), [accountScope]);
  const readScopeRef = useRef(readScope);
  readScopeRef.current = readScope;
  const hasAttemptedBalance = attemptedBalanceScope === readScope;

  const { result: balanceResult, run: refreshBalance } = usePromiseResult(
    async () => {
      if (!canReadBalance) return null;
      try {
        const [balance, lastSyncedAt] = await Promise.all([
          backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountBalance({
            networkId,
            accountId,
          }),
          backgroundApiProxy.servicePrivacyChain
            .getLocalWalletLastSyncedAt({
              networkId,
              accountId,
            })
            .catch(() => undefined),
        ]);
        return {
          scope: readScope,
          balance,
          lastSyncedAt,
        };
      } finally {
        if (readScopeRef.current === readScope) {
          setAttemptedBalanceScope(readScope);
        }
      }
    },
    [readScope, canReadBalance, accountId, networkId],
    {
      pollingInterval:
        canReadBalance && (!accountPaused || pool?.source === 'backend')
          ? PRIVACY_CHAIN_TIP_POLL_MS
          : undefined,
      revalidateOnFocus: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const balance =
    canReadBalance && balanceResult?.scope === readScope
      ? balanceResult.balance
      : undefined;
  const lastSyncedAt =
    balanceResult?.scope === readScope ? balanceResult.lastSyncedAt : undefined;
  // A balance that landed after its read gave up; the poll would show the saved one a full interval.
  useEffect(() => {
    if (!canReadBalance) return;
    const onLanded = (payload: { networkId: string; accountId: string }) => {
      if (payload.networkId !== networkId || payload.accountId !== accountId) {
        return;
      }
      void refreshBalance();
    };
    appEventBus.on(EAppEventBusNames.LocalWalletBalanceLanded, onLanded);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalWalletBalanceLanded, onLanded);
    };
  }, [accountId, canReadBalance, networkId, refreshBalance]);

  // The chain only reports a private address while scanning is on, so nothing is exposed early.
  const canReadAddresses = isActive && hasPooledBalance && !!accountId;
  const { result: addressesResult, run: refreshAddresses } = usePromiseResult(
    async () => {
      if (!canReadAddresses) return null;
      const result =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountAddresses(
          { networkId, accountId },
        );
      return { scope: readScope, addresses: result ?? null };
    },
    [readScope, canReadAddresses, accountId, networkId],
    {
      revalidateOnFocus: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const freshAddresses =
    addressesResult?.scope === readScope
      ? addressesResult.addresses
      : undefined;
  const addresses = canReadBalance
    ? (freshAddresses ?? lastSeen?.addresses)
    : undefined;
  useEffect(() => {
    if (freshState === undefined && freshAddresses === undefined) return;
    const previous = lastSeenByAccount.get(lastSeenKey);
    lastSeenByAccount.set(lastSeenKey, {
      state: freshState ?? previous?.state,
      addresses: freshAddresses ?? previous?.addresses,
    });
  }, [freshAddresses, freshState, lastSeenKey]);

  const { result: progressResult, run: refreshSyncProgress } = usePromiseResult(
    async () => {
      if (!canRead) return null;
      const progress =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletSyncProgress(
          { networkId, accountId },
        );
      return { scope: readScope, progress };
    },
    [readScope, canRead, accountId, networkId],
    {
      pollingInterval: canRead ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const syncProgress =
    canRead && progressResult?.scope === readScope
      ? progressResult.progress
      : undefined;

  const balanceProgressMarker = syncProgress
    ? [
        syncProgress.backfillScannedHeight,
        syncProgress.backfillRemainingBlocks,
        syncProgress.isBackfillComplete,
        syncProgress.tipScannedHeight,
      ].join(':')
    : undefined;
  const lastBalanceProgressRef = useRef<{
    scope: ILocalWalletReadScope;
    marker: string;
  } | null>(null);
  useEffect(() => {
    if (!canReadBalance || balanceProgressMarker === undefined) return;
    const previous = lastBalanceProgressRef.current;
    if (
      previous?.scope === readScope &&
      previous.marker === balanceProgressMarker
    ) {
      return;
    }
    lastBalanceProgressRef.current = {
      scope: readScope,
      marker: balanceProgressMarker,
    };
    void refreshBalance();
  }, [balanceProgressMarker, canReadBalance, readScope, refreshBalance]);

  // Read once right away; the interval's first run is one interval out.
  const readableRef = useRef({ canReadBalance, canRead });
  useEffect(() => {
    const previous = readableRef.current;
    readableRef.current = { canReadBalance, canRead };
    if (canReadBalance && !previous.canReadBalance) {
      void refreshBalance();
    }
    if (canRead && !previous.canRead) {
      void refreshSyncProgress();
    }
  }, [canRead, canReadBalance, refreshBalance, refreshSyncProgress]);

  const refresh = useCallback(() => {
    void refreshState();
    void refreshBalance();
    void refreshAddresses();
    void refreshSyncProgress();
  }, [refreshAddresses, refreshBalance, refreshState, refreshSyncProgress]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const refreshNetworkState = () => void refreshState();
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, refreshNetworkState);
    return () => {
      appEventBus.off(
        EAppEventBusNames.AddedCustomNetwork,
        refreshNetworkState,
      );
    };
  }, [refreshState]);
  const handleActionDone = useCallback(() => {
    refreshRef.current();
  }, []);

  const syncStateAtom = useMemo(
    () =>
      selectAtom(
        privacyChainAtom.atom(),
        (value) => ({
          storageUnsupported:
            value.storageUnsupportedNetworkIds.includes(networkId),
          paused: value.pausedNetworkIds.includes(networkId),
          error:
            value.pausedNetworkIds.includes(networkId) ||
            value.dataBlockedNetworkIds.includes(networkId)
              ? undefined
              : value.syncErrorByNetworkId[networkId],
        }),
        isEqual,
      ),
    [networkId],
  );
  const {
    storageUnsupported: isStorageUnsupported,
    paused: networkPaused,
    error: syncError,
  } = useAtomValue(syncStateAtom);
  const isSyncPaused = networkPaused || accountPaused;
  const hasSyncError = isStorageUnsupported || syncError !== undefined;
  const isPreparing =
    enabled &&
    !isSyncPaused &&
    !hasSyncError &&
    (!syncProgress ||
      (syncProgress.isSyncing && syncProgress.backfillScannedHeight === null));

  const poolBalance: ILocalWalletPoolBalance | undefined = useMemo(
    () => balance?.pools.find((item) => item.key === pool?.key),
    [balance?.pools, pool?.key],
  );
  // A legacy pool has nowhere to receive; offering its address would invite value the chain no longer accepts.
  const poolAddress = useMemo(
    () => getLocalWalletPoolDisplayAddress({ pool, addresses }),
    [addresses, pool],
  );

  useEffect(() => {
    if (!canReadBalance || !pool) return;
    const move = poolBalance?.move;
    const next = {
      ownerKey: privacyChainPoolOwnerKey({ accountId, networkId, poolId }),
      address: poolAddress,
      balanceParsed: poolBalance?.totalParsed,
      balanceSettled: hasAttemptedBalance || hasSyncError || isSyncPaused,
      action: move
        ? {
            type: move.type,
            fromAddress: account?.id === accountId ? account.address : '',
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
    account?.id,
    accountId,
    addresses,
    balance,
    canReadBalance,
    handleActionDone,
    hasAttemptedBalance,
    hasSyncError,
    isActive,
    isSyncPaused,
    networkId,
    pool,
    poolAddress,
    poolBalance,
    poolId,
    setPoolDisplay,
  ]);

  useEffect(() => {
    const ownerKey = privacyChainPoolOwnerKey({ accountId, networkId, poolId });
    const clearDisplay = () => {
      setPoolDisplay((prev) =>
        prev?.ownerKey === ownerKey ? undefined : prev,
      );
    };
    if (!canReadBalance) {
      clearDisplay();
    }
    return clearDisplay;
  }, [accountId, canReadBalance, networkId, poolId, setPoolDisplay]);

  let syncStatusText: string | null;
  if (isStorageUnsupported) {
    syncStatusText = intl.formatMessage({
      id: ETranslations.privacy_error_webview_outdated__msg,
    });
  } else if (isSyncPaused) {
    syncStatusText = intl.formatMessage({
      id: ETranslations.syncing_paused__title,
    });
  } else {
    syncStatusText =
      formatPrivacyChainSyncError(syncError, intl) ??
      formatPrivacyChainSyncDetail({
        progress: syncProgress,
        settings,
        intl,
      }) ??
      (enabled
        ? intl.formatMessage({ id: ETranslations.global_preparing })
        : null);
  }

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
  const refreshBalanceNow = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.refreshLocalWalletAccount({
          networkId,
          accountId,
        });
        refreshRef.current();
      }),
    [accountId, networkId, runBusy],
  );
  // Resumes a chain paused from the sync light, as the light's Sync did.
  const resumeNetworkSync = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
          networkId,
          accountId,
          trigger: 'manual-sync',
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
        setAttemptedBalanceScope(undefined);
        void refreshState();
      }),
    [accountId, networkId, refreshState, runBusy, setPoolDisplay],
  );
  const isReady = (() => {
    if (!hasPooledBalance) return true;
    if (isWalletSupported === undefined) return false;
    if (!isWalletSupported) return true;
    if (state === undefined) return false;
    return true;
  })();

  return {
    settings,
    hasPooledBalance,
    isWalletSupported,
    isUnsupportedWallet,
    pool,
    state,
    isStateSettled: state !== undefined,
    isReady,
    enabled,
    balance,
    lastSyncedAt,
    poolBalance,
    poolAddress,
    addresses,
    syncProgress,
    syncStatusText,
    isPreparing,
    isSyncPaused,
    isNetworkPaused: networkPaused,
    hasSyncError,
    hasAttemptedBalance,
    busy,
    accountName: account?.name,
    isTempWallet: accountSupport === 'tempWallet',
    refresh,
    refreshBalanceNow,
    resumeNetworkSync,
    enableAccount,
    deleteLocalData,
  };
}

export type ILocalWalletPool = ReturnType<typeof useLocalWalletPool>;
