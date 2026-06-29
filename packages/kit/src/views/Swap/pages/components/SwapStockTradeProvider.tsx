import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  type IUseSwapStockChannelReturn,
  useSwapStockChannel,
} from '../../hooks/useSwapStockChannel';

const SwapStockTradeContext = createContext<
  IUseSwapStockChannelReturn | undefined
>(undefined);

export function SwapStockTradeProvider({ children }: PropsWithChildren) {
  const stockChannel = useSwapStockChannel();

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
