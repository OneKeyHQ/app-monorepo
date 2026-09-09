import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';

interface IOrderBookTop {
  bestBid?: string;
  bestAsk?: string;
}

const ORDER_BOOK_RETRY_DELAY_MS = 5000;

export function useCoinOrderBookTop(coin: string): IOrderBookTop {
  const [orderBookTop, setOrderBookTop] = useState<IOrderBookTop>({});

  useEffect(() => {
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchOrderBookTop = async () => {
      setOrderBookTop({});
      try {
        const book =
          await backgroundApiProxy.serviceHyperliquid.fetchL2BookByCoin({
            coin,
          });
        if (disposed) {
          return;
        }
        setOrderBookTop({
          bestBid: book?.levels?.[0]?.[0]?.px,
          bestAsk: book?.levels?.[1]?.[0]?.px,
        });
        refreshTimer = setTimeout(
          fetchOrderBookTop,
          PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
        );
      } catch {
        if (!disposed) {
          refreshTimer = setTimeout(
            fetchOrderBookTop,
            ORDER_BOOK_RETRY_DELAY_MS,
          );
        }
      }
    };

    void fetchOrderBookTop();
    return () => {
      disposed = true;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [coin]);

  return orderBookTop;
}
