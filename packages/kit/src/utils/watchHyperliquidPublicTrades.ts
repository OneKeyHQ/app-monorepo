import { orderBy, uniqBy } from 'lodash';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { PERPS_RECENT_TRADES_LIMIT } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IRecentTrade,
  IWsTrades,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

type IHistoryListener = (trades: IRecentTrade[]) => void;
type IRecoveryGeneration = {
  request?: Promise<boolean>;
  snapshot?: IRecentTrade[];
};
type IPublicTradesHistory = {
  generation: IRecoveryGeneration;
  listeners: Set<IHistoryListener>;
};

const histories = new Map<string, IPublicTradesHistory>();

export function mergePublicTrades(
  incoming: IRecentTrade[],
  previous: IRecentTrade[],
) {
  const unique = uniqBy(
    [...incoming, ...previous],
    (trade) => `${trade.time}:${trade.tid}`,
  );
  return orderBy(unique, ['time', 'tid'], ['desc', 'desc']).slice(
    0,
    PERPS_RECENT_TRADES_LIMIT,
  );
}

export function acquirePublicTradesHistory(
  coin: string,
  listener: IHistoryListener,
) {
  const history: IPublicTradesHistory = histories.get(coin) ?? {
    generation: {},
    listeners: new Set(),
  };
  histories.set(coin, history);
  let observedGeneration = history.generation;
  history.listeners.add(listener);
  if (history.generation.snapshot) listener(history.generation.snapshot);
  return {
    disconnect() {
      if (history.generation === observedGeneration) history.generation = {};
    },
    fetch(reconnect = false) {
      const generation = history.generation;
      observedGeneration = generation;
      if (reconnect && generation.request) return generation.request;
      const isObsolete = () => reconnect && history.generation !== generation;
      const request = backgroundApiProxy.serviceHyperliquid
        .getPerpRecentTrades({ coin })
        .then(
          (trades) => {
            if (isObsolete()) return false;
            const incoming = trades.filter((trade) => trade.coin === coin);
            history.generation.snapshot = mergePublicTrades(
              incoming,
              history.generation.snapshot ?? [],
            );
            history.listeners.forEach((notify) => notify(incoming));
            return true;
          },
          (error: unknown) => {
            if (isObsolete()) return false;
            throw error;
          },
        );
      // Each watcher can acknowledge the same reconnect on a different turn.
      if (reconnect) generation.request = request;
      return request;
    },
    release() {
      history.listeners.delete(listener);
      if (!history.listeners.size) histories.delete(coin);
    },
  };
}

export function watchHyperliquidPublicTrades({
  coin,
  limit,
  onTrades,
  onStatus,
}: {
  coin: string;
  limit?: number;
  onTrades: (trades: IWsTrades, displayOnly?: boolean) => void;
  onStatus?: (status: 'connected' | 'disconnected' | 'failed') => void;
}) {
  const service = backgroundApiProxy.serviceHyperliquidSubscription;
  const request = { coin, limit };
  let disposed = false;
  let acquired = false;
  let failed = false;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const release = () => {
    if (acquired) {
      acquired = false;
      void service.unsubscribePublicTrades(request).catch((error) => {
        console.error(
          'Failed to unsubscribe from Hyperliquid public trades:',
          error,
        );
      });
    }
  };

  const scheduleRetry = () => {
    if (disposed || retryTimer) return;
    retryTimer = setTimeout(
      () => {
        retryTimer = undefined;
        void subscribe();
      },
      Math.min(1000 * 2 ** retryAttempt, 30_000),
    );
    retryAttempt += 1;
  };

  async function subscribe() {
    failed = false;
    try {
      const connected = await service.subscribePublicTrades(request);
      acquired = true;
      retryAttempt = 0;
      if (disposed || failed) {
        release();
        if (failed) scheduleRetry();
      } else {
        onStatus?.(connected ? 'connected' : 'disconnected');
      }
    } catch (error) {
      if (!disposed) {
        console.error(
          'Failed to subscribe to Hyperliquid public trades:',
          error,
        );
        onStatus?.('failed');
        scheduleRetry();
      }
    }
  }

  const handleStatus = (
    event: IAppEventBusPayload[EAppEventBusNames.HyperliquidPublicTradesStatus],
  ) => {
    if (event.coin !== coin) return;
    if (event.status === 'failed') {
      failed = true;
      if (acquired) {
        release();
        scheduleRetry();
      }
    } else if (!acquired) {
      // The acquisition promise returns the current acknowledgement state.
      return;
    }
    onStatus?.(event.status);
  };
  const handleData = (
    payload: IAppEventBusPayload[EAppEventBusNames.HyperliquidDataUpdate],
  ) => {
    if (
      payload.subType === ESubscriptionType.TRADES &&
      Array.isArray(payload.data)
    ) {
      const trades = (payload.data as IWsTrades).filter(
        (trade) => trade.coin === coin,
      );
      if (trades.length) onTrades(trades, payload.displayOnly);
    }
  };

  appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, handleData);
  appEventBus.on(EAppEventBusNames.HyperliquidPublicTradesStatus, handleStatus);
  void subscribe();

  return () => {
    disposed = true;
    clearTimeout(retryTimer);
    appEventBus.off(EAppEventBusNames.HyperliquidDataUpdate, handleData);
    appEventBus.off(
      EAppEventBusNames.HyperliquidPublicTradesStatus,
      handleStatus,
    );
    release();
  };
}
