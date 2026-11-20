import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';

import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ISwapStockSpeedConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  type IUseSwapStockChannelReturn,
  useSwapStockChannel,
} from '../../hooks/useSwapStockChannel';

import { useSwapHistoryChannelIntent } from './SwapHistoryTradeAgainContext';

const SwapStockTradeContext = createContext<
  IUseSwapStockChannelReturn | undefined
>(undefined);

export function SwapStockTradeProvider({
  children,
  storeName,
  stockSpeedConfig,
  stockTradeToken,
}: PropsWithChildren<{
  storeName: EJotaiContextStoreNames;
  stockSpeedConfig?: ISwapStockSpeedConfig;
  stockTradeToken?: ISwapToken;
}>) {
  const historyIntent = useSwapHistoryChannelIntent();
  const stockChannel = useSwapStockChannel(
    stockSpeedConfig,
    stockTradeToken,
    storeName,
    historyIntent,
  );

  return (
    <SwapStockTradeContext.Provider value={stockChannel}>
      {children}
    </SwapStockTradeContext.Provider>
  );
}

export function useSwapStockTradeContext() {
  const context = useContext(SwapStockTradeContext);
  if (!context) {
    throw new OneKeyLocalError(
      'useSwapStockTradeContext must be used within provider',
    );
  }
  return context;
}
