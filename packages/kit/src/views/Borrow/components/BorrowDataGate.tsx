import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { isEmpty } from 'lodash';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import { EBorrowDataStatus } from '../borrowDataStatus';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import { useBorrowReserves } from '../hooks/useBorrowReserves';

const BORROW_POLLING_INTERVAL = 1 * 60 * 1000; // 1 minute
const BORROW_STALE_TTL = BORROW_POLLING_INTERVAL;

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

  const { fetchReserves } = useBorrowReserves();
  const lastFetchKeyRef = useRef<string | null>(null);
  const prevFetchKeyRef = useRef<string | null>(null);
  const lastReservesUpdatedAtRef = useRef<number | null>(null);
  const reservesResultRef = useRef<IBorrowReserveItem | undefined>(undefined);
  const forceRefreshCounterRef = useRef(0);
  const lastForceRefreshCounterRef = useRef(0);
  const wasActiveRef = useRef(isViewActive);
  const prevReservesDataRef = useRef<IBorrowReserveItem | null>(null);

  const accountId = earnAccountData?.accountId ?? earnAccountData?.account?.id;
  const activeAccountId = activeAccount.account?.id;
  const shouldWaitForAccount =
    !activeAccount.ready ||
    (activeAccountId !== undefined && earnAccountData === undefined);
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
    isLoading: reservesLoading,
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
        return reservesResultRef.current;
      }
      lastForceRefreshCounterRef.current = forceRefreshCounterRef.current;
      const result = await fetchReserves({
        provider: marketProvider,
        networkId: marketNetworkId,
        marketAddress,
        accountId,
      });
      reservesResultRef.current = result;
      lastReservesUpdatedAtRef.current = Date.now();
      return result;
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
      if (!market) return EBorrowDataStatus.LoadingMarkets;
      return EBorrowDataStatus.Refreshing;
    }
    if (!market || !fetchKey) return EBorrowDataStatus.Idle;
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

    return EBorrowDataStatus.Idle;
  }, [
    isViewActive,
    marketsLoading,
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
    if (prevFetchKeyRef.current !== fetchKey) {
      prevFetchKeyRef.current = fetchKey;
      lastReservesUpdatedAtRef.current = null;
      reservesResultRef.current = undefined;
    }
  }, [fetchKey]);

  useEffect(() => {
    setMarket(market ?? null);
  }, [market, setMarket]);

  useEffect(() => {
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
    const isLoading =
      dataStatus === EBorrowDataStatus.LoadingMarkets ||
      dataStatus === EBorrowDataStatus.WaitingForAccount ||
      dataStatus === EBorrowDataStatus.LoadingReserves;

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
