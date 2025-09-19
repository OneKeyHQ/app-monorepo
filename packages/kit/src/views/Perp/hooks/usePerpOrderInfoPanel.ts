import { useEffect, useMemo, useRef, useState } from 'react';

import {
  usePerpsSelectedAccountAtom,
  usePerpsSelectedSymbolAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { IFill, IWsUserFills } from '@onekeyhq/shared/types/hyperliquid';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useOpenOrdersListAtom,
  usePositionListAtom,
} from '../../../states/jotai/contexts/hyperliquid';

export function usePerpPositions() {
  const [positions] = usePositionListAtom();
  return positions;
}

export function usePerpOrders() {
  const [orders] = useOpenOrdersListAtom();
  return orders;
}

interface INewTradesHistory {
  fill: IFill;
  userId: string | null;
  coinId: string;
}

export function usePerpTradesHistory() {
  const [currentAccount] = usePerpsSelectedAccountAtom();
  const [currentToken] = usePerpsSelectedSymbolAtom();
  const { coin } = currentToken;
  const [newTradesHistory, setNewTradesHistory] = useState<INewTradesHistory[]>(
    [],
  );
  const newTradesHistoryRef = useRef<INewTradesHistory[]>([]);
  useEffect(() => {
    if (
      !currentAccount?.accountAddress ||
      newTradesHistoryRef.current.length === 0
    ) {
      return;
    }
    const filterNewTradesHistory = newTradesHistoryRef.current.filter(
      (trade) =>
        trade.coinId === coin &&
        trade.userId === currentAccount?.accountAddress,
    );
    setNewTradesHistory(filterNewTradesHistory);
  }, [currentAccount?.accountAddress, coin]);
  useEffect(() => {
    if (!currentAccount?.accountAddress) return;

    const handleUserFillsListUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'account';
        subType: string;
        data: IWsUserFills;
        metadata: {
          timestamp: number;
          source: string;
          userId?: string;
        };
      };

      if (eventPayload.subType !== ESubscriptionType.USER_FILLS) return;

      if (eventPayload.metadata.userId !== currentAccount?.accountAddress)
        return;

      const { data } = eventPayload;

      if (data.isSnapshot) return;

      const relevantFills = data.fills.filter(
        (fill: IFill) => fill.coin === coin,
      );

      if (relevantFills.length === 0) return;

      setNewTradesHistory((prev) => [
        ...prev,
        ...relevantFills.map((fill) => ({
          fill,
          userId: currentAccount?.accountAddress,
          coinId: coin,
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
  }, [currentAccount?.accountAddress, coin]);
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (currentAccount?.accountAddress) {
        const trades = await backgroundApiProxy.serviceHyperliquid.getUserFills(
          {
            user: currentAccount?.accountAddress,
            aggregateByTime: true,
          },
        );
        const sortedTrades = trades.sort((a, b) => b.time - a.time);
        return sortedTrades;
      }
      return [];
    },
    [currentAccount?.accountAddress],
    { watchLoading: true, initResult: [] },
  );

  const mergeTradesHistory = useMemo(() => {
    if (newTradesHistory.length === 0) {
      return result;
    }

    const existingOrderIds = new Set(result.map((trade) => trade.oid));
    const newUniqueTrades = newTradesHistory
      .filter(
        (trade) =>
          !existingOrderIds.has(trade.fill.oid) &&
          trade.coinId === coin &&
          trade.userId === currentAccount?.accountAddress,
      )
      .map((trade) => trade.fill);

    if (newUniqueTrades.length === 0) {
      return result;
    }

    return [...result, ...newUniqueTrades]
      .filter((t) => !t.coin.startsWith('@'))
      ?.sort((a, b) => b.time - a.time);
  }, [currentAccount?.accountAddress, coin, newTradesHistory, result]);

  return {
    trades: mergeTradesHistory,
    isLoading,
  };
}
