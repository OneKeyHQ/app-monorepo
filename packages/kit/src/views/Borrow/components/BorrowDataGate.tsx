import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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
import {
  EBorrowDataStatus,
  deriveBorrowDataStatus,
  isBorrowReservesPending,
} from '../borrowDataStatus';
import {
  getBorrowEarnAccountForNetwork,
  getBorrowEarnAccountId,
} from '../borrowEarnAccount';
import { buildBorrowMarketKey, useBorrowContext } from '../BorrowProvider';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import { useBorrowReserves } from '../hooks/useBorrowReserves';

import {
  getOwnedBorrowReservesResult,
  isCurrentBorrowReservesRequest,
  shouldRefreshBorrowDataOnActivation,
} from './borrowDataGate.utils';

const BORROW_POLLING_INTERVAL = 1 * 60 * 1000; // 1 minute
const BORROW_STALE_TTL = BORROW_POLLING_INTERVAL;
const BORROW_DERIVE_TYPE_REFRESH_DELAY_MS = 300;

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
  const availableMarkets = useMemo(() => markets ?? [], [markets]);
  const borrowNetworkIds = useMemo(() => {
    const ids = availableMarkets.map((item) => item.networkId);
    return [
      ...new Set(
        ids.filter((networkId): networkId is string => Boolean(networkId)),
      ),
    ];
  }, [availableMarkets]);
  useEffect(() => {
    onBorrowNetworksChange?.(borrowNetworkIds);
  }, [borrowNetworkIds, onBorrowNetworksChange, isViewActive]);

  const {
    market,
    rememberedMarketKey,
    setMarkets,
    setMarket,
    setReserves,
    setEarnAccount,
    setBorrowDataStatus,
  } = useBorrowContext();

  useEffect(() => {
    setMarkets(availableMarkets);
  }, [availableMarkets, setMarkets]);

  useEffect(() => {
    setMarket((currentMarket) => {
      if (!availableMarkets.length) {
        return currentMarket ? null : currentMarket;
      }

      const currentMarketKey = buildBorrowMarketKey(currentMarket ?? undefined);
      const refreshedCurrentMarket = availableMarkets.find(
        (item) => buildBorrowMarketKey(item) === currentMarketKey,
      );
      if (refreshedCurrentMarket) {
        return refreshedCurrentMarket;
      }
      // Land on the remembered market directly rather than let the restore
      // correct it afterwards: that correction costs a discarded reserves
      // request and a frame showing the wrong market. Only when nothing is
      // selected yet — a refresh that drops the current market still falls
      // back, and the user's own pick is never overridden.
      if (!currentMarket && rememberedMarketKey) {
        const rememberedMarket = availableMarkets.find(
          (item) => buildBorrowMarketKey(item) === rememberedMarketKey,
        );
        if (rememberedMarket) {
          return rememberedMarket;
        }
      }

      return availableMarkets[0];
    });
  }, [availableMarkets, rememberedMarketKey, setMarket]);

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
  const reservesResultOwnerKeyRef = useRef<string | null>(null);
  const reservesRequestIdRef = useRef(0);
  const forceRefreshCounterRef = useRef(0);
  const lastForceRefreshCounterRef = useRef(0);
  const wasActiveRef = useRef(isViewActive);
  const prevReservesDataRef = useRef<IBorrowReserveItem | null>(null);
  const [reservesErrorOwnerKey, setReservesErrorOwnerKey] = useState<
    string | null
  >(null);

  const marketProvider = market?.provider;
  const marketNetworkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const currentMarketKey = market ? buildBorrowMarketKey(market) : undefined;
  const scopedEarnAccountData = getBorrowEarnAccountForNetwork(
    earnAccountData,
    marketNetworkId,
  );
  const accountId = getBorrowEarnAccountId(scopedEarnAccountData);
  const activeAccountId = activeAccount.account?.id;
  const activeIndexedAccountId = activeAccount.indexedAccount?.id;
  const hasAccountContext = Boolean(activeAccountId || activeIndexedAccountId);
  const shouldWaitForAccount =
    !activeAccount.ready ||
    (hasAccountContext && scopedEarnAccountData === undefined);
  const fetchKey = useMemo(
    () =>
      !isEmpty(market)
        ? `${marketProvider}-${marketNetworkId}-${marketAddress}-${
            accountId ?? 'public'
          }`
        : null,
    [market, marketProvider, marketNetworkId, marketAddress, accountId],
  );

  // Invalidate before usePromiseResult reruns for the new key; a later effect
  // can let that rerun reuse the previous account's still-fresh TTL cache.
  if (prevFetchKeyRef.current !== fetchKey) {
    prevFetchKeyRef.current = fetchKey;
    reservesRequestIdRef.current += 1;
    lastReservesUpdatedAtRef.current = null;
    reservesResultRef.current = undefined;
    reservesResultOwnerKeyRef.current = null;
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
      const requestKey = fetchKey;
      const requestId = reservesRequestIdRef.current + 1;
      reservesRequestIdRef.current = requestId;
      setReservesErrorOwnerKey(null);
      const isCurrentRequest = () =>
        isCurrentBorrowReservesRequest({
          requestKey,
          currentKey: prevFetchKeyRef.current,
          requestId,
          currentRequestId: reservesRequestIdRef.current,
        });
      try {
        const result = await fetchReserves({
          provider: marketProvider,
          networkId: marketNetworkId,
          marketAddress,
          accountId,
        });
        if (!isCurrentRequest()) {
          return reservesResultRef.current;
        }
        reservesResultRef.current = result;
        reservesResultOwnerKeyRef.current = requestKey;
        lastReservesUpdatedAtRef.current = Date.now();
        return result;
      } catch (error) {
        if (isCurrentRequest()) {
          setReservesErrorOwnerKey(requestKey);
        }
        throw error;
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
  const ownedReservesResult = getOwnedBorrowReservesResult({
    result: reservesResult,
    resultOwnerKey: reservesResultOwnerKeyRef.current,
    currentKey: fetchKey,
  });

  const refreshReservesWithForce = useMemo(() => {
    return async () => {
      forceRefreshCounterRef.current += 1;
      await refreshReserves();
    };
  }, [refreshReserves]);

  const dataStatus = useMemo(
    () =>
      deriveBorrowDataStatus({
        isViewActive,
        wasViewActive: wasActiveRef.current,
        hasCachedReserves: Boolean(prevReservesDataRef.current),
        marketsLoading,
        hasMarket: Boolean(market),
        hasFetchKey: Boolean(fetchKey),
        shouldWaitForAccount,
        reservesLoading,
        isCurrentFetchKey: lastFetchKeyRef.current === fetchKey,
        hasOwnedReservesResult: ownedReservesResult !== undefined,
        hasReservesError: reservesErrorOwnerKey === fetchKey,
      }),
    [
      isViewActive,
      marketsLoading,
      market,
      fetchKey,
      shouldWaitForAccount,
      reservesLoading,
      ownedReservesResult,
      reservesErrorOwnerKey,
    ],
  );

  useEffect(() => {
    isViewActiveRef.current = isViewActive;
    if (
      shouldRefreshBorrowDataOnActivation({
        isViewActive,
        wasViewActive: wasActiveRef.current,
      })
    ) {
      void refetchMarkets();
      void refreshReserves();
    }
    wasActiveRef.current = isViewActive;
  }, [isViewActive, refetchMarkets, refreshReserves]);

  // Sync earnAccount to Context using IAsyncData format
  useEffect(() => {
    setEarnAccount({
      data: scopedEarnAccountData ?? null,
      loading:
        Boolean(earnAccountLoading) ||
        Boolean(
          hasAccountContext &&
          marketNetworkId &&
          scopedEarnAccountData === undefined,
        ),
      refresh: () => refreshAccount(),
      ownerMarketKey: currentMarketKey,
    });
  }, [
    currentMarketKey,
    earnAccountLoading,
    hasAccountContext,
    marketNetworkId,
    refreshAccount,
    scopedEarnAccountData,
    setEarnAccount,
  ]);

  // Sync reserves to Context using IAsyncData format
  useLayoutEffect(() => {
    setBorrowDataStatus(dataStatus);

    const isLoading = isBorrowReservesPending(dataStatus);

    // Determine the data to set
    let dataToSet: IBorrowReserveItem | null = prevReservesDataRef.current;
    if (lastFetchKeyRef.current !== fetchKey) {
      lastFetchKeyRef.current = fetchKey;
      dataToSet = null;
    } else if (
      dataStatus === EBorrowDataStatus.LoadingMarkets ||
      dataStatus === EBorrowDataStatus.WaitingForAccount
    ) {
      dataToSet = null;
    } else if (
      dataStatus === EBorrowDataStatus.Ready &&
      ownedReservesResult !== undefined
    ) {
      dataToSet = ownedReservesResult;
    }

    // Update the ref for next comparison
    prevReservesDataRef.current = dataToSet;

    setReserves({
      data: dataToSet,
      loading: isLoading,
      refresh: refreshReservesWithForce,
      ownerMarketKey: currentMarketKey,
    });
  }, [
    currentMarketKey,
    dataStatus,
    fetchKey,
    ownedReservesResult,
    refreshReservesWithForce,
    setBorrowDataStatus,
    setReserves,
  ]);

  return <>{children}</>;
};
