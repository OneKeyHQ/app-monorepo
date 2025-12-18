import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { isEmpty } from 'lodash';

import { useIsFocusedTab } from '@onekeyhq/components';

import { useBorrowContext } from '../BorrowProvider';
import { useBorrowMarkets } from '../hooks/useBorrowMarkets';
import { useBorrowReserves } from '../hooks/useBorrowReserves';
import { useEarnAccount } from '../hooks/useEarnAccount';

export const BorrowDataGate = ({ children }: { children: ReactNode }) => {
  const isFocused = useIsFocusedTab();
  const { markets, isLoading: marketsLoading } = useBorrowMarkets({
    isActive: isFocused,
  });
  const market = useMemo(() => markets?.[0], [markets]);
  const { setMarket, setReserves, setReservesLoading, reserves } =
    useBorrowContext();
  const { earnAccount } = useEarnAccount({
    networkId: market?.networkId,
  });
  const { fetchReserves } = useBorrowReserves();
  const requestIdRef = useRef(0);
  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setMarket(market ?? null);
  }, [market, setMarket]);

  useEffect(() => {
    const accountId = earnAccount?.account?.id;
    const fetchKey =
      !isEmpty(market) && accountId
        ? `${market.provider}-${market.marketAddress}-${accountId}`
        : null;

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
    const needFetch = keyChanged || !reserves;
    if (!needFetch) {
      return;
    }

    lastFetchKeyRef.current = fetchKey;

    setReservesLoading(true);
    if (keyChanged) {
      setReserves(null);
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    void fetchReserves({
      provider: market.provider,
      networkId: market.networkId,
      marketAddress: market.marketAddress,
      accountId: accountId!,
    })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setReserves(result);
      })
      .catch(() => {})
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setReservesLoading(false);
      });
  }, [
    market,
    earnAccount?.account?.id,
    fetchReserves,
    setReserves,
    setReservesLoading,
    isFocused,
    marketsLoading,
    reserves,
  ]);

  return <>{children}</>;
};
