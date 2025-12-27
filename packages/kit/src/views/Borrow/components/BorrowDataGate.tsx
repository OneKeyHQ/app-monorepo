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

export const BorrowDataGate = ({ children }: { children: ReactNode }) => {
  const isFocused = useIsFocused();
  const { markets, isLoading: marketsLoading } = useBorrowMarkets({
    isActive: isFocused,
  });
  const market = useMemo(() => markets?.[0], [markets]);
  const { setMarket, setReserves, setReservesLoading } = useBorrowContext();
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

  const { result: reservesResult, isLoading: reservesLoading } =
    usePromiseResult(
      async () => {
        if (
          !isFocused ||
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
        isFocused,
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
        checkIsFocused: false,
        undefinedResultIfReRun: true,
        undefinedResultIfError: true,
      },
    );

  useEffect(() => {
    setMarket(market ?? null);
  }, [market, setMarket]);

  useEffect(() => {
    if (!isFocused) {
      lastFetchKeyRef.current = null;
      setReserves(null);
      setReservesLoading(false);
      return;
    }

    if (!fetchKey) {
      lastFetchKeyRef.current = null;
      setReserves(null);
      setReservesLoading(marketsLoading);
      return;
    }

    const keyChanged = lastFetchKeyRef.current !== fetchKey;
    if (keyChanged) {
      lastFetchKeyRef.current = fetchKey;
      setReserves(null);
    }

    if (!keyChanged && reservesResult !== undefined) {
      setReserves(reservesResult);
    }
    setReservesLoading(keyChanged || Boolean(reservesLoading));
  }, [
    isFocused,
    fetchKey,
    marketsLoading,
    setReserves,
    setReservesLoading,
    reservesResult,
    reservesLoading,
  ]);

  return <>{children}</>;
};
