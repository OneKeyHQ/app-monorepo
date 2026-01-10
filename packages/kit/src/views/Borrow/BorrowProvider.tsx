import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import type { ISwapConfig } from './components/BorrowTableList';
import type { IBorrowPendingTx } from './hooks/useBorrowTxUpdate';

export type IBorrowRefreshReservesFn = (options?: {
  alwaysSetState?: boolean;
}) => Promise<void>;

type IBorrowRef<T> = {
  current: T | null;
};

export const borrowRefreshReservesRef: IBorrowRef<IBorrowRefreshReservesFn> = {
  current: null,
};
export const borrowRefreshPendingRef: IBorrowRef<() => Promise<void>> = {
  current: null,
};

type IBorrowContextValue = {
  reserves: IBorrowReserveItem | null;
  setReserves: React.Dispatch<React.SetStateAction<IBorrowReserveItem | null>>;
  market: IBorrowMarketItem | null;
  setMarket: React.Dispatch<React.SetStateAction<IBorrowMarketItem | null>>;
  reservesLoading: boolean;
  setReservesLoading: React.Dispatch<React.SetStateAction<boolean>>;
  swapConfig: ISwapConfig;
  // Pending transactions state
  pendingTxs: IBorrowPendingTx[];
  setPendingTxs: (txs: IBorrowPendingTx[]) => void;
  refreshReservesRef: IBorrowRef<IBorrowRefreshReservesFn>;
  refreshPendingRef: IBorrowRef<() => Promise<void>>;
  refreshRewardsRef: IBorrowRef<() => Promise<void>>;
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
  const [pendingTxs, setPendingTxsState] = useState<IBorrowPendingTx[]>([]);
  const refreshReservesRef = borrowRefreshReservesRef;
  const refreshPendingRef = borrowRefreshPendingRef;
  const refreshRewardsRef = useRef<(() => Promise<void>) | null>(null);

  // Stable setter that won't cause unnecessary re-renders
  const setPendingTxs = useCallback((txs: IBorrowPendingTx[]) => {
    setPendingTxsState(txs);
  }, []);

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
      pendingTxs,
      setPendingTxs,
      refreshReservesRef,
      refreshPendingRef,
      refreshRewardsRef,
    };
  }, [
    reserves,
    market,
    reservesLoading,
    swapConfig,
    pendingTxs,
    setPendingTxs,
    refreshReservesRef,
    refreshPendingRef,
  ]);

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
