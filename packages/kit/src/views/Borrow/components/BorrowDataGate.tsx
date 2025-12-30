import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { isEmpty } from 'lodash';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import { useBorrowReserves } from '../hooks/useBorrowReserves';
import { useBorrowTxUpdate } from '../hooks/useBorrowTxUpdate';

enum EBorrowDataStatus {
  Idle = 'Idle',
  LoadingMarkets = 'LoadingMarkets',
  WaitingForAccount = 'WaitingForAccount',
  LoadingReserves = 'LoadingReserves',
  Refreshing = 'Refreshing',
  Ready = 'Ready',
}

const BORROW_POLLING_INTERVAL = 3 * 60 * 1000; // 3 minutes

export const BorrowDataGate = ({ children }: { children: ReactNode }) => {
  const isFocused = useIsFocused();
  const { markets, isLoading: marketsLoading } = useBorrowMarkets();
  const market = useMemo(() => markets?.[0], [markets]);
  const { reserves, setMarket, setReserves, setReservesLoading } =
    useBorrowContext();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { earnAccount } = useEarnAccount({
    networkId: market?.networkId,
  });
  const { fetchReserves } = useBorrowReserves();
  const lastFetchKeyRef = useRef<string | null>(null);
  const accountId = earnAccount?.account?.id;
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
        return undefined;
      }
      return fetchReserves({
        provider: marketProvider,
        networkId: marketNetworkId,
        marketAddress,
        accountId,
      });
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
      undefinedResultIfReRun: false,
      undefinedResultIfError: true,
      pollingInterval: BORROW_POLLING_INTERVAL,
      revalidateOnFocus: true,
    },
  );

  const dataStatus = useMemo(() => {
    if (!isFocused) return EBorrowDataStatus.Idle;
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
    isFocused,
    marketsLoading,
    market,
    fetchKey,
    shouldWaitForAccount,
    reservesLoading,
    reserves,
    reservesResult,
  ]);

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

  const { isPending } = useBorrowTxUpdate({
    accountId,
    networkId: marketNetworkId,
    provider: marketProvider,
    onRefresh: () => {
      // Re-fetch all reserves
      // The simplest way to trigger re-fetch is to invalidate the cache or manually call the fetch function
      // But here we rely on the `usePromiseResult` at line 54 re-running if we had a way to trigger it.
      // However, `usePromiseResult` returns `run` (aliased as `refreshReserves` below) which we can call.
      void refreshReserves();
    },
  });

  return <>{children}</>;
};
