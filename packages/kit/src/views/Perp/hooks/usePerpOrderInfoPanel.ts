import { useEffect, useMemo, useState } from 'react';

import { usePerpsSelectedAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { IFill, IWsUserFills } from '@onekeyhq/shared/types/hyperliquid';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useCurrentTokenAtom,
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

export function usePerpTradesHistory() {
  const [currentAccount] = usePerpsSelectedAccountAtom();
  const [currentToken] = useCurrentTokenAtom();
  const [newTradesHistory, setNewTradesHistory] = useState<IFill[]>([]);
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
        (fill: IFill) => fill.coin === currentToken,
      );

      if (relevantFills.length === 0) return;

      setNewTradesHistory(relevantFills);
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
  }, [currentAccount?.accountAddress, currentToken]);
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
    const newUniqueTrades = newTradesHistory.filter(
      (trade) => !existingOrderIds.has(trade.oid),
    );

    if (newUniqueTrades.length === 0) {
      return result;
    }

    return [...result, ...newUniqueTrades].sort((a, b) => b.time - a.time);
  }, [newTradesHistory, result]);

  return {
    trades: mergeTradesHistory,
    isLoading,
  };
}
