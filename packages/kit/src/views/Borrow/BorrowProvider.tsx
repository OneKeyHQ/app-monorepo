import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import type { ISwapConfig } from './components/BorrowTableList';

type IBorrowContextValue = {
  reserves: IBorrowReserveItem | null;
  setReserves: React.Dispatch<React.SetStateAction<IBorrowReserveItem | null>>;
  market: IBorrowMarketItem | null;
  setMarket: React.Dispatch<React.SetStateAction<IBorrowMarketItem | null>>;
  reservesLoading: boolean;
  setReservesLoading: React.Dispatch<React.SetStateAction<boolean>>;
  swapConfig: ISwapConfig;
};

const defaultSwapConfig: ISwapConfig = {
  isSupportSwap: false,
  isSupportCrossChain: false,
};

const BorrowContext = createContext<IBorrowContextValue | null>(null);

export const BorrowProvider = ({
  children,
}: PropsWithChildren<{
  value?: IBorrowContextValue;
}>) => {
  const [reserves, setReserves] = useState<IBorrowReserveItem | null>(null);
  const [market, setMarket] = useState<IBorrowMarketItem | null>(null);
  const [reservesLoading, setReservesLoading] = useState(false);

  // Fetch swap config when market networkId changes
  const { result: swapConfig } = usePromiseResult(
    async () => {
      const networkId = market?.networkId;
      if (!networkId) {
        return defaultSwapConfig;
      }
      return backgroundApiProxy.serviceSwap.checkSupportSwap({
        networkId,
      });
    },
    [market?.networkId],
    { initResult: defaultSwapConfig },
  );

  const contextValue = useMemo(() => {
    return {
      reserves,
      setReserves,
      market,
      setMarket,
      reservesLoading,
      setReservesLoading,
      swapConfig,
    };
  }, [reserves, market, reservesLoading, swapConfig]);

  return (
    <BorrowContext.Provider value={contextValue}>
      {children}
    </BorrowContext.Provider>
  );
};

export const useBorrowContext = () => {
  const context = useContext(BorrowContext);
  if (!context) {
    throw new OneKeyLocalError(
      'useBorrowContext must be used within a BorrowProvider',
    );
  }
  return context;
};
