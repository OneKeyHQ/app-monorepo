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
  PRIVACY_CHAIN_SYNC_STATUS_LABELS,
  formatPrivacyChainSyncDetail,
  formatPrivacyChainSyncError,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getLocalWalletAccountSyncStatus } from '@onekeyhq/kit-bg/src/utils/privacyChainSyncStatus';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountState,
  ILocalWalletAccountSupport,
  ILocalWalletPoolBalance,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getLocalWalletPoolDisplayAddress } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import { PRIVACY_CHAIN_TIP_POLL_MS } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

type ILocalWalletSettings = NonNullable<IVaultSettings['localWallet']>;

// Last state/addresses seen per account, in memory only; reopening the page shows them at once.
const lastSeenByAccount = new Map<
  string,
  {
    support?: ILocalWalletAccountSupport;
    state?: ILocalWalletAccountState;
    addresses?: ILocalWalletAccountAddresses | null;
  }
>();

export function resetLocalWalletPoolLastSeen() {
  lastSeenByAccount.clear();
}

// Reads what decides the token page's layout before it mounts, so it opens
// on the right one instead of switching once these reads land.
export async function preloadLocalWalletPool({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const [support, state] = await Promise.all([
    backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountSupport({
      networkId,
      accountId,
    }),
    backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState({
      networkId,
      accountId,
    }),
  ]);
  const key = `${networkId}:${accountId}`;
  lastSeenByAccount.set(key, {
    ...lastSeenByAccount.get(key),
    support,
    state,
  });
}
type ILocalWalletReadScope = {
  accountScope: { networkId: string; accountId: string; revision: number };
};
type ILocalWalletRefreshRequest = {
  scope: ILocalWalletReadScope;
  afterSequence?: number;
  sessionId?: string;
  observedSessionId?: string;
  promise: Promise<void>;
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
  const [pendingRefresh, setPendingRefresh] =
    useState<ILocalWalletRefreshRequest>();
  const refreshRequestRef = useRef<ILocalWalletRefreshRequest>(undefined);
  const [revision, setRevision] = useState(0);
  const revalidateRef = useRef<() => void>(() => {});
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

  const lastSeenKey = `${networkId}:${accountId}`;
  const lastSeen = lastSeenByAccount.get(lastSeenKey);

  // Read from the chain rather than inferred from the account id: Monero has no hardware
  // keyring, so a hardware account there can never scan despite looking scannable. Read again on
  // every change notice (a temp wallet kept), keeping this account's last answer meanwhile.
  const { result: accountSupportResult, run: refreshSupport } =
    usePromiseResult(async () => {
      if (!hasPooledBalance || !accountId) return undefined;
      return {
        scope: accountScope,
        support:
          await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountSupport(
            { networkId, accountId },
          ),
      };
    }, [hasPooledBalance, accountScope, accountId, networkId]);
  const freshSupport =
    accountSupportResult?.scope.networkId === networkId &&
    accountSupportResult.scope.accountId === accountId
      ? accountSupportResult.support
      : undefined;
  const accountSupport = freshSupport ?? lastSeen?.support;
  const isWalletSupported =
    accountSupport === undefined ? undefined : accountSupport === 'supported';
  const isUnsupportedWallet = isWalletSupported === false;

  // Privacy settings open in a retained modal, so invalidate on this event even without a focus change.
  useEffect(() => {
    if (!hasPooledBalance) return;
    const invalidate = (payload: {
      networkId: string;
      accountIds: string[];
      change?: 'syncState';
    }) => {
      if (
        payload.networkId !== networkId ||
        !payload.accountIds.includes(accountId)
      ) {
        return;
      }
      // Pause/resume keeps the same data owner. Destructive or unclassified notices
      // still invalidate immediately, including while the page is retained offscreen.
      if (payload.change === 'syncState') {
        revalidateRef.current();
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
  // An open privacy token page wants fresh data, not after the full startup quiet window.
  useEffect(() => {
    if (!canRead) return;
    void backgroundApiProxy.servicePrivacyChain
      .onLocalWalletPageOpened({ networkId })
      .catch(() => undefined);
  }, [canRead, networkId]);
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
  const readLastSyncedAt =
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
    if (
      freshSupport === undefined &&
      freshState === undefined &&
      freshAddresses === undefined
    ) {
      return;
    }
    const previous = lastSeenByAccount.get(lastSeenKey);
    lastSeenByAccount.set(lastSeenKey, {
      support: freshSupport ?? previous?.support,
      state: freshState ?? previous?.state,
      addresses: freshAddresses ?? previous?.addresses,
    });
  }, [freshAddresses, freshState, freshSupport, lastSeenKey]);

  // This account's slice of the published scan state, so other accounts' progress does not
  // re-render it. The scheduler publishes after each pass; the read below covers an account it
  // has not reached yet.
  const scanAtom = useMemo(
    () =>
      selectAtom(
        privacyChainAtom.atom(),
        (value): IPrivacyChainScanState => {
          const key = `${networkId}:${accountId}`;
          const progress = value.progress[key];
          const completion = value.completedScanByAccount?.[key];
          const syncError = value.syncErrorByNetworkId[networkId];
          const ofNetwork = (ids: string[]) =>
            ids.filter((id) => id === networkId);
          return {
            progress: progress ? { [key]: progress } : {},
            completedScanByAccount: completion
              ? { [key]: completion }
              : undefined,
            boostingNetworkIds: ofNetwork(value.boostingNetworkIds),
            dataBlockedNetworkIds: ofNetwork(value.dataBlockedNetworkIds),
            pausedNetworkIds: ofNetwork(value.pausedNetworkIds),
            preparingAccountKeys: value.preparingAccountKeys.filter(
              (item) => item === key,
            ),
            storageUnsupportedNetworkIds: ofNetwork(
              value.storageUnsupportedNetworkIds,
            ),
            syncErrorByNetworkId: syncError ? { [networkId]: syncError } : {},
            scanAllowed: value.scanAllowed,
          };
        },
        isEqual,
      ),
    [networkId, accountId],
  );
  const scan = useAtomValue(scanAtom);
  const publishedProgress = scan.progress[`${networkId}:${accountId}`];
  const scanCompletion =
    scan.completedScanByAccount?.[`${networkId}:${accountId}`];
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
    { overrideIsFocused: (isPageFocused) => isPageFocused && isActive },
  );
  const readProgress =
    progressResult?.scope === readScope ? progressResult.progress : undefined;
  const syncProgress = canRead
    ? (publishedProgress ?? readProgress)
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
  revalidateRef.current = () => {
    void refreshSupport();
    refresh();
  };
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

  const syncView = state
    ? getLocalWalletAccountSyncStatus({
        scan,
        networkId,
        accountId,
        account: state,
        unavailable: isUnsupportedWallet,
        progress: canRead ? readProgress : undefined,
        syncedBelowBlocks: settings?.syncedBelowBlocks ?? 1,
        blockTime: settings,
      })
    : undefined;
  const syncStatus = syncView?.status;
  const isSyncPaused =
    syncStatus === 'accountPaused' || syncStatus === 'chainPaused';
  const hasSyncError =
    syncStatus === 'error' || syncStatus === 'storageUnsupported';
  const isPreparing = syncStatus === 'preparing' || syncStatus === 'enabling';
  const finishRefresh = useCallback((request: ILocalWalletRefreshRequest) => {
    if (refreshRequestRef.current !== request) return;
    refreshRequestRef.current = undefined;
    setPendingRefresh(undefined);
  }, []);
  useEffect(() => {
    if (!pendingRefresh) return;
    const hasCompleted =
      pendingRefresh.afterSequence !== undefined &&
      scanCompletion !== undefined &&
      scanCompletion.sessionId === pendingRefresh.sessionId &&
      scanCompletion.sequence > pendingRefresh.afterSequence;
    const backgroundRestarted =
      pendingRefresh.sessionId !== undefined &&
      scanCompletion !== undefined &&
      scanCompletion.sessionId !== pendingRefresh.sessionId &&
      scanCompletion.sessionId !== pendingRefresh.observedSessionId;
    const stopped =
      !isActive ||
      pendingRefresh.scope !== readScope ||
      isSyncPaused ||
      hasSyncError ||
      syncStatus === 'waitingWifi' ||
      syncStatus === 'off' ||
      syncStatus === 'unavailable' ||
      backgroundRestarted ||
      (pendingRefresh.afterSequence !== undefined &&
        scan.scanAllowed === false);
    if (hasCompleted || stopped) {
      finishRefresh(pendingRefresh);
      if (hasCompleted && pendingRefresh.scope === readScope) {
        refreshRef.current();
      }
    }
  }, [
    finishRefresh,
    hasSyncError,
    isActive,
    isSyncPaused,
    pendingRefresh,
    scanCompletion,
    readScope,
    scan.scanAllowed,
    syncStatus,
  ]);
  useEffect(
    () => () => {
      refreshRequestRef.current = undefined;
    },
    [],
  );

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

  let syncStatusText: string | null = null;
  if (syncStatus === 'storageUnsupported') {
    syncStatusText = intl.formatMessage({
      id: ETranslations.privacy_error_webview_outdated__msg,
    });
  } else if (syncStatus === 'error') {
    syncStatusText =
      formatPrivacyChainSyncError(syncView?.syncError, intl) ?? null;
  } else if (isSyncPaused) {
    syncStatusText = intl.formatMessage({
      id: PRIVACY_CHAIN_SYNC_STATUS_LABELS[syncStatus],
    });
  } else if (isPreparing) {
    syncStatusText = intl.formatMessage({
      id: PRIVACY_CHAIN_SYNC_STATUS_LABELS.preparing,
    });
  } else if (syncStatus) {
    // The panel shows the percentage beside this line already.
    syncStatusText = formatPrivacyChainSyncDetail({
      progress: syncProgress,
      settings,
      stopped: syncStatus === 'waitingWifi',
      shownAbove: 'percent',
      intl,
    });
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
  const refreshBalanceNow = useCallback(() => {
    const existing = refreshRequestRef.current;
    if (existing?.scope === readScope) return existing.promise;
    const request: ILocalWalletRefreshRequest = {
      scope: readScope,
      observedSessionId: scanCompletion?.sessionId,
      promise: Promise.resolve(),
    };
    refreshRequestRef.current = request;
    setPendingRefresh(request);
    request.promise = (async () => {
      try {
        const result =
          await backgroundApiProxy.servicePrivacyChain.refreshLocalWalletAccount(
            { networkId, accountId },
          );
        if (refreshRequestRef.current !== request) return;
        refreshRef.current();
        if (
          !result?.scanRequested ||
          result.afterSequence === undefined ||
          !result.sessionId
        ) {
          finishRefresh(request);
          return;
        }
        // Scheduling is not completion: the bridged atom publishes a newer sequence only
        // after a caught-up pass for this account is still valid for its current epoch.
        const pending = {
          ...request,
          afterSequence: result.afterSequence,
          sessionId: result.sessionId,
        };
        refreshRequestRef.current = pending;
        setPendingRefresh(pending);
      } catch (error) {
        finishRefresh(request);
        throw error;
      }
    })();
    return request.promise;
  }, [
    accountId,
    finishRefresh,
    networkId,
    readScope,
    scanCompletion?.sessionId,
  ]);
  // A Sync the user pressed: Preparing at once, a pass even at an unchanged tip, a chain pause lifted.
  const startSync = useCallback(
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
  const pauseSync = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.disableLocalWalletAccount({
          networkId,
          accountId,
        });
        refreshRef.current();
      }),
    [accountId, networkId, runBusy],
  );
  const isReady = (() => {
    // A privacy chain whose settings are still loading is not "no pools" yet.
    if (!hasPooledBalance)
      return !networkUtils.isLocalWalletNetwork({ networkId });
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
    // Published with each caught-up pass, so a Refresh at an unchanged tip still moves it.
    lastSyncedAt: publishedProgress?.lastSyncedAt ?? readLastSyncedAt,
    poolBalance,
    poolAddress,
    addresses,
    syncProgress,
    syncStatusText,
    syncStatus,
    isPreparing,
    isSyncPaused,
    isNetworkPaused: syncStatus === 'chainPaused',
    hasSyncError,
    hasAttemptedBalance,
    actionBusy: busy,
    busy: busy || pendingRefresh?.scope === readScope,
    accountName: account?.name,
    isTempWallet: accountSupport === 'tempWallet',
    refresh,
    refreshBalanceNow,
    startSync,
    pauseSync,
    enableAccount,
  };
}

export type ILocalWalletPool = ReturnType<typeof useLocalWalletPool>;

// What Sync/Resume does for the account's status, the same on every surface.
export function getLocalWalletSyncAction(
  lw: Pick<
    ILocalWalletPool,
    'syncStatus' | 'enableAccount' | 'startSync' | 'refreshBalanceNow'
  >,
): () => Promise<void> {
  if (lw.syncStatus === 'accountPaused') return () => lw.enableAccount({});
  if (lw.syncStatus === 'chainPaused' || lw.syncStatus === 'error') {
    return lw.startSync;
  }
  return lw.refreshBalanceNow;
}
