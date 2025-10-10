import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { noop } from 'lodash';

import {
  usePerpsActiveAccountAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  PERPS_HISTORY_FILLS_URL,
  PERPS_USER_FILLS_TIME_RANGE,
} from '@onekeyhq/shared/src/consts/perp';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IFill, IWsUserFills } from '@onekeyhq/shared/types/hyperliquid';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

interface INewTradesHistory {
  fill: IFill;
  userId: string | null;
}

export function usePerpTradesHistory() {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [currentListPage, setCurrentListPage] = useState(1);
  const [newTradesHistory, setNewTradesHistory] = useState<INewTradesHistory[]>(
    [],
  );
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();
  const newTradesHistoryRef = useRef<INewTradesHistory[]>([]);
  useEffect(() => {
    if (
      !currentAccount?.accountAddress ||
      newTradesHistoryRef.current.length === 0
    ) {
      return;
    }
    const filterNewTradesHistory = newTradesHistoryRef.current.filter(
      (trade) => trade.userId === currentAccount?.accountAddress,
    );
    setNewTradesHistory(filterNewTradesHistory);
  }, [currentAccount?.accountAddress]);
  useEffect(() => {
    if (!currentAccount?.accountAddress) return;

    const handleUserFillsListUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'account';
        subType: string;
        data: IWsUserFills;
      };

      if (eventPayload.subType !== ESubscriptionType.USER_FILLS) return;

      if (
        !eventPayload?.data?.user ||
        eventPayload?.data?.user?.toLowerCase() !==
          currentAccount?.accountAddress?.toLowerCase()
      ) {
        return;
      }

      const { data } = eventPayload;

      if (data.isSnapshot) return;

      const relevantFills = [...data.fills];

      if (relevantFills.length === 0) return;

      setNewTradesHistory((prev) => [
        ...prev,
        ...relevantFills.map((fill) => ({
          fill,
          userId: currentAccount?.accountAddress,
        })),
      ]);
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
  }, [currentAccount?.accountAddress]);
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (currentAccount?.accountAddress) {
        noop(refreshHook);
        const now = Date.now();
        const startTime = now - PERPS_USER_FILLS_TIME_RANGE;
        const trades =
          await backgroundApiProxy.serviceHyperliquid.getUserFillsByTime({
            user: currentAccount?.accountAddress,
            startTime,
            aggregateByTime: true,
          });
        const sortedTrades = trades.sort((a, b) => b.time - a.time);
        setCurrentListPage(1);
        return sortedTrades;
      }
      return [];
    },
    [currentAccount?.accountAddress, refreshHook],
    { watchLoading: true, initResult: [] },
  );

  const mergeTradesHistory = useMemo(() => {
    let mergedTrades = result;
    if (newTradesHistory.length > 0) {
      const existingOrderIds = new Set(result.map((trade) => trade.oid));
      const newUniqueTrades = newTradesHistory
        .filter(
          (trade) =>
            !existingOrderIds.has(trade.fill.oid) &&
            trade.userId === currentAccount?.accountAddress,
        )
        .map((trade) => trade.fill);

      if (newUniqueTrades.length === 0) {
        return result;
      }
      mergedTrades = [...mergedTrades, ...newUniqueTrades];
    }
    const filteredTrades = mergedTrades.filter((t) => !t.coin.startsWith('@'));
    return filteredTrades?.sort((a, b) => b.time - a.time);
  }, [currentAccount?.accountAddress, newTradesHistory, result]);

  return {
    trades: mergeTradesHistory,
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
