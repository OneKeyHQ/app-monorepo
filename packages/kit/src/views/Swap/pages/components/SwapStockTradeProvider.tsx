import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';

import { useAutoRefreshTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useAutoRefreshTokenDetail';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketPresetTokenContext } from '@onekeyhq/shared/types/swap/types';

import {
  type IUseSwapStockChannelReturn,
  useSwapStockChannel,
} from '../../hooks/useSwapStockChannel';

const SwapStockTradeContext = createContext<
  IUseSwapStockChannelReturn | undefined
>(undefined);

function StockTokenDetailAutoRefreshContent({
  isNative,
  networkId,
  tokenAddress,
}: {
  isNative: boolean;
  networkId: string;
  tokenAddress: string;
}) {
  useAutoRefreshTokenDetail({
    tokenAddress,
    networkId,
    isNative,
  });

  return null;
}

function StockTokenDetailAutoRefresh() {
  const { tokenAddress, networkId, isNative } = useTokenDetail();
  if (!networkId || (!tokenAddress && !isNative)) {
    return null;
  }

  return (
    <StockTokenDetailAutoRefreshContent
      tokenAddress={tokenAddress ?? ''}
      networkId={networkId}
      isNative={!!isNative}
    />
  );
}

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
      <StockTokenDetailAutoRefresh />
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
