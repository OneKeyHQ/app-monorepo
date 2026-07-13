import { useCallback, useEffect, useRef, useState } from 'react';

import { noop } from 'lodash';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsTradesHistoryDataAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  PERPS_HISTORY_FILLS_URL,
  PERPS_TWAP_HISTORY_URL,
} from '@onekeyhq/shared/src/consts/perp';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';

export function usePerpTradesHistory() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [perpsTradesData] = usePerpsTradesHistoryDataAtom();
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();

  const [currentListPage, setCurrentListPage] = useState(1);
  const prevAccountRef = useRef<string | null | undefined>(undefined);

  const refreshTradesHistory = useCallback(async () => {
    const accountAddress = currentAccount?.accountAddress;
    if (!accountAddress) {
      await backgroundApiProxy.serviceHyperliquid.resetTradesHistory();
      return;
    }

    await backgroundApiProxy.serviceHyperliquid.loadTradesHistory(
      accountAddress,
      { force: true },
    );
    await backgroundApiProxy.serviceHyperliquidSubscription.refreshSubscriptionForUserFills();
  }, [currentAccount?.accountAddress]);
  const refreshTradesHistoryRef = useRef(refreshTradesHistory);
  refreshTradesHistoryRef.current = refreshTradesHistory;

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
    const timer = setTimeout(() => {
      if (isFocusedRef.current) {
        void refreshTradesHistoryRef.current();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshHook]);

  // Spot and perps fills both come from the same USER_FILLS WS subscription
  const tradesData = perpsTradesData;
  const isCurrentAccountHistory =
    !!currentAccount?.accountAddress &&
    tradesData?.accountAddress?.toLowerCase() ===
      currentAccount.accountAddress.toLowerCase();
  const fills: IFill[] = isCurrentAccountHistory
    ? (tradesData?.fills ?? [])
    : [];
  const isLoaded: boolean =
    (tradesData?.isLoaded ?? false) && isCurrentAccountHistory;
  const hasAccountAddress = Boolean(currentAccount?.accountAddress);

  return {
    trades: fills,
    currentListPage,
    setCurrentListPage,
    mode: activeTradeInstrument.mode,
    refreshTradesHistory,
    // If current account has no Perp address (unsupported or not created yet),
    // show empty state instead of skeleton loading.
    isLoading: hasAccountAddress ? !isLoaded : false,
  };
}

function usePerpViewAllUrl(baseUrl: string) {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const onViewAllUrl = useCallback(() => {
    if (currentAccount?.accountAddress) {
      openUrlInApp(`${baseUrl}${currentAccount.accountAddress}`);
    }
  }, [baseUrl, currentAccount?.accountAddress]);
  return {
    onViewAllUrl,
  };
}

export function usePerpTradesHistoryViewAllUrl() {
  return usePerpViewAllUrl(PERPS_HISTORY_FILLS_URL);
}

export function usePerpTwapHistoryViewAllUrl() {
  return usePerpViewAllUrl(PERPS_TWAP_HISTORY_URL);
}
