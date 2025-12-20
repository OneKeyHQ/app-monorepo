import { useCallback, useEffect, useRef, useState } from 'react';

import { noop } from 'lodash';

import {
  usePerpsActiveAccountAtom,
  usePerpsTradesHistoryDataAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_HISTORY_FILLS_URL } from '@onekeyhq/shared/src/consts/perp';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';

export function usePerpTradesHistory() {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [tradesData] = usePerpsTradesHistoryDataAtom();
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();

  const [currentListPage, setCurrentListPage] = useState(1);
  const prevAccountRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const accountAddress = currentAccount?.accountAddress;

    if (prevAccountRef.current !== accountAddress) {
      setCurrentListPage(1);
      prevAccountRef.current = accountAddress;
    }

    if (!accountAddress) {
      void backgroundApiProxy.serviceHyperliquid.resetTradesHistory();
      return;
    }

    void backgroundApiProxy.serviceHyperliquid.loadTradesHistory(
      accountAddress,
    );
  }, [currentAccount?.accountAddress]);

  const isFocusedRef = useRef(true);

  useListenTabFocusState(
    ETabRoutes.Perp,
    useCallback((isFocus: boolean) => {
      isFocusedRef.current = isFocus;
    }, []),
  );

  useEffect(() => {
    noop(refreshHook);
    setTimeout(() => {
      if (isFocusedRef.current) {
        void backgroundApiProxy.serviceHyperliquidSubscription.refreshSubscriptionForUserFills();
      }
    }, 300);
  }, [refreshHook]);

  const fills: IFill[] = tradesData?.fills ?? [];
  const isLoaded: boolean = tradesData?.isLoaded ?? false;
  const hasAccountAddress = Boolean(currentAccount?.accountAddress);

  return {
    trades: fills,
    currentListPage,
    setCurrentListPage,
    // If current account has no Perp address (unsupported or not created yet),
    // show empty state instead of skeleton loading.
    isLoading: hasAccountAddress ? !isLoaded : false,
  };
}

export function usePerpTradesHistoryViewAllUrl() {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const onViewAllUrl = useCallback(() => {
    if (currentAccount?.accountAddress) {
      openUrlInApp(
        `${PERPS_HISTORY_FILLS_URL}${currentAccount?.accountAddress}`,
      );
    }
  }, [currentAccount?.accountAddress]);
  return {
    onViewAllUrl,
  };
}
