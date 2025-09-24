import { useCallback } from 'react';

import type { IWebViewRef } from '../../../WebView/types';
import type { ITradeEvent } from '../types';

// simple trade event push hook
export function useTradeUpdates({
  webRef,
  onTradeUpdate,
}: {
  webRef: React.RefObject<IWebViewRef | null>;
  onTradeUpdate?: (trade: ITradeEvent) => void;
}) {
  const pushTradeUpdate = useCallback(
    (trade: ITradeEvent) => {
      onTradeUpdate?.(trade);
      webRef.current?.sendMessageViaInjectedScript({
        type: 'TRADE_UPDATE',
        payload: trade,
      });
    },
    [webRef, onTradeUpdate],
  );

  return { pushTradeUpdate };
}

// mock trade event for testing
export const simulateTradeEvent = (
  symbol: string,
  pushFn: (trade: ITradeEvent) => void,
) => {
  const mockTrade: ITradeEvent = {
    symbol,
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    size: (Math.random() * 0.5 + 0.1).toFixed(3),
    price: (40_000 + Math.random() * 10_000).toFixed(2),
    time: Date.now() / 1000,
    txHash: `0x${Math.random().toString(16).substring(2, 10)}`,
  };
  pushFn(mockTrade);
};

