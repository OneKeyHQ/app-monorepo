import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { isEmpty } from 'lodash';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import { EBorrowDataStatus, isBorrowDataLoading } from '../borrowDataStatus';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import { useBorrowReserves } from '../hooks/useBorrowReserves';

const BORROW_POLLING_INTERVAL = 1 * 60 * 1000; // 1 minute
const BORROW_STALE_TTL = BORROW_POLLING_INTERVAL;
const BORROW_DERIVE_TYPE_REFRESH_DELAY_MS = 300;
// How long a "settled with nothing to show" status is held back before the
// cards are allowed to swap their skeleton for the real empty copy.
const BORROW_EMPTY_STATE_HOLD_MS = 200;

export const BorrowDataGate = ({
  children,
  isActive = true,
  onBorrowNetworksChange,
}: {
  children: ReactNode;
  isActive?: boolean;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
}) => {
  const isFocused = useIsFocused();
  const isViewActive = isFocused && isActive;
  const isViewActiveRef = useRef(isViewActive);
  const {
    markets,
    isLoading: marketsLoading,
    refetchMarkets,
    hasSettled: marketsSettled,
  } = useBorrowMarkets({ isActive: isViewActive });
  const market = useMemo(() => markets?.[0], [markets]);
  const borrowNetworkIds = useMemo(() => {
    const ids = (markets ?? []).map((item) => item.networkId);
    return [
      ...new Set(
        ids.filter((networkId): networkId is string => Boolean(networkId)),
      ),
    ];
  }, [markets]);
  useEffect(() => {
    onBorrowNetworksChange?.(borrowNetworkIds);
  }, [borrowNetworkIds, onBorrowNetworksChange, isViewActive]);

  const { setMarket, setReserves, setEarnAccount, setBorrowDataStatus } =
    useBorrowContext();

  const { activeAccount } = useActiveAccount({ num: 0 });
  const {
    earnAccount: earnAccountData,
    refreshAccount,
    isLoading: earnAccountLoading,
  } = useEarnAccount({
    networkId: market?.networkId,
  });

  useEffect(() => {
    if (!market?.networkId) {
      return undefined;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshAccountAfterDeriveTypeChanged = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        void refreshAccount({ alwaysSetState: true });
      }, BORROW_DERIVE_TYPE_REFRESH_DELAY_MS);
    };

    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      refreshAccountAfterDeriveTypeChanged,
    );
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      refreshAccountAfterDeriveTypeChanged,
    );

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        refreshAccountAfterDeriveTypeChanged,
      );
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        refreshAccountAfterDeriveTypeChanged,
      );
    };
  }, [market?.networkId, refreshAccount]);

  const { fetchReserves } = useBorrowReserves();
  const lastFetchKeyRef = useRef<string | null>(null);
  const prevFetchKeyRef = useRef<string | null>(null);
  const lastReservesUpdatedAtRef = useRef<number | null>(null);
  const reservesResultRef = useRef<IBorrowReserveItem | undefined>(undefined);
  const forceRefreshCounterRef = useRef(0);
  const lastForceRefreshCounterRef = useRef(0);
  // Whether a reserves request has actually finished for the current fetch key,
  // successfully or not. The runner below bails out early (no key yet, view
  // inactive, account not ready) and that no-op settle leaves isLoading false
  // with no result, which is not the same as a finished-but-empty load.
  const reservesSettledRef = useRef(false);
  // Mirrors what consumers currently see; BorrowProvider starts at
  // LoadingMarkets.
  const publishedStatusRef = useRef(EBorrowDataStatus.LoadingMarkets);
  const wasActiveRef = useRef(isViewActive);
  const prevReservesDataRef = useRef<IBorrowReserveItem | null>(null);

  const accountId = earnAccountData?.accountId ?? earnAccountData?.account?.id;
  const activeAccountId = activeAccount.account?.id;
  const activeIndexedAccountId = activeAccount.indexedAccount?.id;
  const hasAccountContext = Boolean(activeAccountId || activeIndexedAccountId);
  const shouldWaitForAccount =
    !activeAccount.ready ||
    (hasAccountContext && earnAccountData === undefined);
  const marketProvider = market?.provider;
  const marketNetworkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const fetchKey = useMemo(
    () =>
      !isEmpty(market)
        ? `${marketProvider}-${marketAddress}-${accountId ?? 'public'}`
        : null,
    [market, marketProvider, marketAddress, accountId],
  );

  // Invalidate before usePromiseResult reruns for the new key; a later effect
  // can let that rerun reuse the previous account's still-fresh TTL cache.
  if (prevFetchKeyRef.current !== fetchKey) {
    prevFetchKeyRef.current = fetchKey;
    lastReservesUpdatedAtRef.current = null;
    reservesResultRef.current = undefined;
    reservesSettledRef.current = false;
  }

  // Reset staleness on modal dismiss so revalidateOnFocus triggers a fresh fetch.
  // Must be declared BEFORE usePromiseResult so the effect fires first.
  const isRouteFocused = useRouteIsFocused();
  const prevRouteFocusedRef = useRef(isRouteFocused);
  useEffect(() => {
    if (isRouteFocused && !prevRouteFocusedRef.current) {
      lastReservesUpdatedAtRef.current = null;
    }
    prevRouteFocusedRef.current = isRouteFocused;
  }, [isRouteFocused]);

  const {
    result: reservesResult,
    // OK-60105: undefined until usePromiseResult's effect has fired, which left
    // dataStatus falling through to Idle between markets resolving and the
    // reserves request starting. useBorrowMarkets already defaults the same
    // way; the terminal Idle (settled with no result, e.g. after an error) is
    // untouched, so a failed load still reaches the real empty state.
    isLoading: reservesLoading = true,
    run: refreshReserves,
  } = usePromiseResult(
    async () => {
      if (
        !fetchKey ||
        !marketProvider ||
        !marketNetworkId ||
        !marketAddress ||
        shouldWaitForAccount
      ) {
        return reservesResultRef.current;
      }
      const shouldForceRefresh =
        forceRefreshCounterRef.current > lastForceRefreshCounterRef.current;
      if (!isViewActiveRef.current && !shouldForceRefresh) {
        return reservesResultRef.current;
      }
      const lastUpdatedAt = lastReservesUpdatedAtRef.current;
      const isStale =
        !lastUpdatedAt || Date.now() - lastUpdatedAt > BORROW_STALE_TTL;
      // Also fetch if we have no cached result (e.g., after fetchKey changed and cache was cleared)
      const hasNoCache = reservesResultRef.current === undefined;
      const shouldFetch = shouldForceRefresh || isStale || hasNoCache;
      if (!shouldFetch) {
        // Fresh cache means an earlier request already landed for this key.
        reservesSettledRef.current = true;
        return reservesResultRef.current;
      }
      lastForceRefreshCounterRef.current = forceRefreshCounterRef.current;
      try {
        const result = await fetchReserves({
          provider: marketProvider,
          networkId: marketNetworkId,
          marketAddress,
          accountId,
        });
        reservesResultRef.current = result;
        lastReservesUpdatedAtRef.current = Date.now();
        return result;
      } finally {
        // In `finally` so a failed request also counts as settled and the cards
        // fall through to the real empty state instead of spinning forever.
        reservesSettledRef.current = true;
      }
    },
    [
      fetchKey,
      marketProvider,
      marketNetworkId,
      marketAddress,
      accountId,
      shouldWaitForAccount,
      fetchReserves,
    ],
    {
      watchLoading: true,
      checkIsFocused: true,
      undefinedResultIfReRun: true,
      undefinedResultIfError: true,
      pollingInterval: isViewActive ? BORROW_POLLING_INTERVAL : undefined,
      revalidateOnFocus: true,
      alwaysSetState: true,
    },
  );

  const refreshReservesWithForce = useMemo(() => {
    return async () => {
      forceRefreshCounterRef.current += 1;
      await refreshReserves();
    };
  }, [refreshReserves]);

  const dataStatus = useMemo(() => {
    if (!isViewActive) return EBorrowDataStatus.Idle;
    if (marketsLoading) {
      // Refreshing means "keep what is already on screen". With no reserves
      // rendered yet there is nothing to keep, and since Refreshing is not a
      // loading status the cards would paint their empty copy for the frame —
      // mirror the reserves branch below and stay in a loading status.
      if (!market || !prevReservesDataRef.current) {
        return EBorrowDataStatus.LoadingMarkets;
      }
      return EBorrowDataStatus.Refreshing;
    }
    // The markets runner bails out with an empty list while the view is
    // inactive, so an empty `markets` is only a settled result once a real
    // request has finished (a failed one counts, so errors still reach the
    // empty state rather than spinning).
    if (!market || !fetchKey) {
      return marketsSettled
        ? EBorrowDataStatus.Idle
        : EBorrowDataStatus.LoadingMarkets;
    }
    if (shouldWaitForAccount) return EBorrowDataStatus.WaitingForAccount;

    if (reservesLoading) {
      if (
        !prevReservesDataRef.current ||
        lastFetchKeyRef.current !== fetchKey
      ) {
        return EBorrowDataStatus.LoadingReserves;
      }
      return EBorrowDataStatus.Refreshing;
    }

    if (reservesResult !== undefined) {
      return EBorrowDataStatus.Ready;
    }

    // Not loading and no result: either the request finished with nothing (an
    // error, or a genuinely empty market — a settled state the cards should
    // render), or the runner bailed out early and its no-op settle flipped
    // isLoading to false before the real request ever started. Only the first
    // is Idle; publishing the second as Idle is what flashed the empty copy in
    // the middle of a load.
    return reservesSettledRef.current
      ? EBorrowDataStatus.Idle
      : EBorrowDataStatus.LoadingReserves;
  }, [
    isViewActive,
    marketsLoading,
    marketsSettled,
    market,
    fetchKey,
    shouldWaitForAccount,
    reservesLoading,
    reservesResult,
  ]);

  useEffect(() => {
    isViewActiveRef.current = isViewActive;
    if (isViewActive && !wasActiveRef.current) {
      void refetchMarkets();
      void refreshReserves();
    }
    wasActiveRef.current = isViewActive;
  }, [isViewActive, refetchMarkets, refreshReserves]);

  useEffect(() => {
    setMarket(market ?? null);
  }, [market, setMarket]);

  useEffect(() => {
    // Belt and braces for the empty-state flash. Every hole found so far was
    // the same shape: a status that reads as "settled" arrives for a frame or
    // two while nothing has been rendered yet, and each card dutifully paints
    // its real empty copy before the next load starts. Rather than enumerate
    // every runner that can settle early, hold such a status briefly — if a
    // load starts in the meantime the timer is cancelled and the loading status
    // goes out immediately, and a genuinely empty result is delayed by an
    // interval no one can perceive. Ready is never held: it always carries a
    // result, and prevReservesDataRef still lags it by one commit here.
    const isSettledWithNothingToShow =
      !isBorrowDataLoading(dataStatus) &&
      dataStatus !== EBorrowDataStatus.Ready &&
      !prevReservesDataRef.current;

    if (
      isSettledWithNothingToShow &&
      isBorrowDataLoading(publishedStatusRef.current)
    ) {
      const timer = setTimeout(() => {
        publishedStatusRef.current = dataStatus;
        setBorrowDataStatus(dataStatus);
      }, BORROW_EMPTY_STATE_HOLD_MS);
      return () => clearTimeout(timer);
    }

    publishedStatusRef.current = dataStatus;
    setBorrowDataStatus(dataStatus);
  }, [dataStatus, setBorrowDataStatus]);

  useEffect(() => {
    if (reservesResult !== undefined) {
      reservesResultRef.current = reservesResult;
    }
  }, [reservesResult]);

  // Sync earnAccount to Context using IAsyncData format
  useEffect(() => {
    setEarnAccount({
      data: earnAccountData ?? null,
      loading: earnAccountLoading ?? false,
      refresh: () => refreshAccount(),
    });
  }, [earnAccountData, earnAccountLoading, refreshAccount, setEarnAccount]);

  // Sync reserves to Context using IAsyncData format
  useEffect(() => {
    const isLoading = isBorrowDataLoading(dataStatus);

    // Determine the data to set
    let dataToSet: IBorrowReserveItem | null = prevReservesDataRef.current;
    if (
      dataStatus === EBorrowDataStatus.LoadingMarkets ||
      dataStatus === EBorrowDataStatus.WaitingForAccount
    ) {
      dataToSet = null;
    } else if (dataStatus === EBorrowDataStatus.LoadingReserves) {
      if (lastFetchKeyRef.current !== fetchKey) {
        lastFetchKeyRef.current = fetchKey;
        dataToSet = null;
      }
    } else if (
      dataStatus === EBorrowDataStatus.Ready &&
      reservesResult !== undefined
    ) {
      dataToSet = reservesResult;
    }

    // Update the ref for next comparison
    prevReservesDataRef.current = dataToSet;

    setReserves({
      data: dataToSet,
      loading: isLoading,
      refresh: refreshReservesWithForce,
    });
  }, [
    dataStatus,
    fetchKey,
    reservesResult,
    refreshReservesWithForce,
    setReserves,
  ]);

  return <>{children}</>;
};
