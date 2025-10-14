import { useCallback, useEffect, useRef, useState } from 'react';

import { isEqual, noop } from 'lodash';

import {
  usePerpsActiveAccountAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_HISTORY_FILLS_URL } from '@onekeyhq/shared/src/consts/perp';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IFill, IWsUserFills } from '@onekeyhq/shared/types/hyperliquid';
import {
  EPerpsSubscriptionCategory,
  ESubscriptionType,
} from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function usePerpTradesHistory() {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const currentAccountAddressRef = useRef(currentAccount?.accountAddress);
  currentAccountAddressRef.current = currentAccount?.accountAddress;

  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();

  const [isLoading, setIsLoading] = useState(true);
  const [currentListPage, setCurrentListPage] = useState(1);
  const [tradesHistory, setTradesHistory] = useState<IFill[]>([]);

  const tradesHistoryRef = useRef<IFill[]>([]);
  if (tradesHistoryRef.current !== tradesHistory) {
    tradesHistoryRef.current = tradesHistory;
  }

  const tradesHistoryAccountRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const handleUserFillsListUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: EPerpsSubscriptionCategory;
        subType: ESubscriptionType;
        data: IWsUserFills;
      };

      if (
        eventPayload.type === EPerpsSubscriptionCategory.ACCOUNT &&
        eventPayload.subType === ESubscriptionType.USER_FILLS
      ) {
        setIsLoading(false);
        const { data } = eventPayload;
        if (data.fills.length === 0) {
          return;
        }
        const newFills = [...data.fills]
          .filter((fill) => !fill.coin.startsWith('@'))
          .sort((a, b) => b.time - a.time);
        const newFirstFillItem = newFills[0];
        const prevFirstFillItem = tradesHistoryRef.current[0];

        const eventUserAddress = eventPayload.data?.user?.toLowerCase();
        const currentAccountAddress =
          currentAccountAddressRef.current?.toLowerCase();

        if (eventUserAddress && eventUserAddress === currentAccountAddress) {
          const isFirstItemEqual = isEqual(prevFirstFillItem, newFirstFillItem);
          // check if first item is the same, then skip merge
          if (isFirstItemEqual && prevFirstFillItem) {
            return;
          }
          tradesHistoryAccountRef.current = currentAccountAddress;
          if (data.isSnapshot) {
            setTradesHistory((_prev) => [...newFills]);
          } else {
            setTradesHistory((prev) => [...newFills, ...prev]);
          }
        } else if (
          prevFirstFillItem &&
          tradesHistoryAccountRef.current &&
          tradesHistoryAccountRef.current !== currentAccountAddress
        ) {
          // reset trades history if account not matched
          tradesHistoryAccountRef.current = currentAccountAddress;
          setTradesHistory([]);
        }
      }
    };

    appEventBus.on(
      EAppEventBusNames.HyperliquidDataUpdate,
      handleUserFillsListUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleUserFillsListUpdate,
      );
    };
  }, []);

  useEffect(() => {
    setCurrentListPage(1); // reset to page 1 when account changed
    tradesHistoryAccountRef.current = '';
    setTradesHistory([]);
    if (currentAccount?.accountAddress) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [currentAccount?.accountAddress]);

  useEffect(() => {
    noop(refreshHook);
    void backgroundApiProxy.serviceHyperliquidSubscription.updateSubscriptionForUserFills();
  }, [refreshHook]);

  console.log('usePerpTradesHistory__render', tradesHistory, refreshHook);

  return {
    trades: tradesHistory,
    currentListPage,
    setCurrentListPage,
    isLoading,
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
