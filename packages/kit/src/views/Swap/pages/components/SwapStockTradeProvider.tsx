import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IMarketPresetTokenContext,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  type IUseSwapStockChannelReturn,
  useSwapStockChannel,
} from '../../hooks/useSwapStockChannel';

const SwapStockTradeContext = createContext<
  IUseSwapStockChannelReturn | undefined
>(undefined);

export function SwapStockTradeProvider({
  children,
  marketPresetToken,
  routeStockToken,
}: PropsWithChildren<{
  marketPresetToken?: IMarketPresetTokenContext;
  routeStockToken?: ISwapToken;
}>) {
  const stockChannel = useSwapStockChannel({
    marketPresetToken,
    routeStockToken,
  });

  return (
    <SwapStockTradeContext.Provider value={stockChannel}>
      {children}
    </SwapStockTradeContext.Provider>
  );
}

export function SwapStockTradeProviderBoundary({
  children,
  marketPresetToken,
  routeStockToken,
}: PropsWithChildren<{
  marketPresetToken?: IMarketPresetTokenContext;
  routeStockToken?: ISwapToken;
}>) {
  const context = useContext(SwapStockTradeContext);
  if (context) {
    return <>{children}</>;
  }
  return (
    <SwapStockTradeProvider
      marketPresetToken={marketPresetToken}
      routeStockToken={routeStockToken}
    >
      {children}
    </SwapStockTradeProvider>
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

export function useOptionalSwapStockTradeContext() {
  return useContext(SwapStockTradeContext);
}
