import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketPresetTokenContext } from '@onekeyhq/shared/types/swap/types';

import {
  type IUseSwapStockChannelReturn,
  useSwapStockChannel,
} from '../../hooks/useSwapStockChannel';

const SwapStockTradeContext = createContext<
  IUseSwapStockChannelReturn | undefined
>(undefined);

export function SwapStockTradeProvider({
  children,
  disableNativePayToken,
  marketPresetToken,
}: PropsWithChildren<{
  marketPresetToken?: IMarketPresetTokenContext;
  disableNativePayToken?: boolean;
}>) {
  const stockChannel = useSwapStockChannel({
    marketPresetToken,
    disableNativePayToken,
  });

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
