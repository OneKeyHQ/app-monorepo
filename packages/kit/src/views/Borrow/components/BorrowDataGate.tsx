import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { isEmpty } from 'lodash';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import { EBorrowDataStatus } from '../borrowDataStatus';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import { useBorrowReserves } from '../hooks/useBorrowReserves';

const BORROW_POLLING_INTERVAL = 3 * 60 * 1000; // 3 minutes
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
  const {
    reserves,
    setMarket,
    setReserves,
    setReservesLoading,
    setBorrowDataStatus,
    refreshReservesRef,
  } = useBorrowContext();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { earnAccount } = useEarnAccount({
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
  const accountId = earnAccount?.accountId ?? earnAccount?.account?.id;
  const activeAccountId = activeAccount.account?.id;
  const shouldWaitForAccount =
    !activeAccount.ready ||
    (activeAccountId !== undefined && earnAccount === undefined);
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
      if (!isViewActiveRef.current) {
        return reservesResultRef.current;
      }
      const lastUpdatedAt = lastReservesUpdatedAtRef.current;
      const isStale =
        !lastUpdatedAt || Date.now() - lastUpdatedAt > BORROW_STALE_TTL;
      const shouldForceRefresh =
        forceRefreshCounterRef.current > lastForceRefreshCounterRef.current;
      const shouldFetch = shouldForceRefresh || isStale;
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
    },
  );

  const dataStatus = useMemo(() => {
    if (!isViewActive) return EBorrowDataStatus.Idle;
    if (marketsLoading) {
      if (!market) return EBorrowDataStatus.LoadingMarkets;
      return EBorrowDataStatus.Refreshing;
    }
    if (!market || !fetchKey) return EBorrowDataStatus.Idle;
    if (shouldWaitForAccount) return EBorrowDataStatus.WaitingForAccount;

    if (reservesLoading) {
      if (!reserves || lastFetchKeyRef.current !== fetchKey) {
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
    reserves,
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
    switch (dataStatus) {
      case EBorrowDataStatus.Idle:
        setReservesLoading(false);
        break;
      case EBorrowDataStatus.LoadingMarkets:
      case EBorrowDataStatus.WaitingForAccount:
        setReserves(null);
        setReservesLoading(true);
        break;
      case EBorrowDataStatus.LoadingReserves:
        if (lastFetchKeyRef.current !== fetchKey) {
          lastFetchKeyRef.current = fetchKey;
          setReserves(null);
        }
        setReservesLoading(true);
        break;
      case EBorrowDataStatus.Refreshing:
        setReservesLoading(false);
        break;
      case EBorrowDataStatus.Ready:
        if (reservesResult !== undefined) {
          setReserves(reservesResult);
        }
        setReservesLoading(false);
        break;
      default:
        break;
    }
  }, [dataStatus, fetchKey, reservesResult, setReserves, setReservesLoading]);

  useEffect(() => {
    setBorrowDataStatus(dataStatus);
  }, [dataStatus, setBorrowDataStatus]);

  const refreshReservesWithForce = useMemo(() => {
    return async () => {
      forceRefreshCounterRef.current += 1;
      await refreshReserves();
    };
  }, [refreshReserves]);

  useEffect(() => {
    refreshReservesRef.current = refreshReservesWithForce;
  }, [refreshReservesRef, refreshReservesWithForce]);

  useEffect(() => {
    if (reservesResult !== undefined) {
      reservesResultRef.current = reservesResult;
    }
  }, [reservesResult]);

  return <>{children}</>;
};
