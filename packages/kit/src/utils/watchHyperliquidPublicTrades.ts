import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IWsTrades } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export function watchHyperliquidPublicTrades({
  coin,
  limit,
  onTrades,
  onStatus,
}: {
  coin: string;
  limit?: number;
  onTrades: (trades: IWsTrades) => void;
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
    if (event.status !== 'disconnected' && event.coin !== coin) return;
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
      if (trades.length) onTrades(trades);
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
