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
import type { IStakePendingTx } from '@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import { EBorrowDataStatus } from './borrowDataStatus';

import type { ISwapConfig } from './components/BorrowTableList';

export type IBorrowRefreshReservesFn = (options?: {
  alwaysSetState?: boolean;
}) => Promise<void>;

type IBorrowRef<T> = {
  current: T | null;
};

export const borrowRefreshReservesRef: IBorrowRef<IBorrowRefreshReservesFn> = {
  current: null,
};

type IBorrowContextValue = {
  reserves: IBorrowReserveItem | null;
  setReserves: React.Dispatch<React.SetStateAction<IBorrowReserveItem | null>>;
  market: IBorrowMarketItem | null;
  setMarket: React.Dispatch<React.SetStateAction<IBorrowMarketItem | null>>;
  reservesLoading: boolean;
  setReservesLoading: React.Dispatch<React.SetStateAction<boolean>>;
  borrowDataStatus: EBorrowDataStatus;
  setBorrowDataStatus: React.Dispatch<React.SetStateAction<EBorrowDataStatus>>;
  swapConfig: ISwapConfig;
  // Pending transactions state
  pendingTxs: IStakePendingTx[];
  setPendingTxs: (txs: IStakePendingTx[]) => void;
  refreshReservesRef: IBorrowRef<IBorrowRefreshReservesFn>;
  refreshRewardsRef: IBorrowRef<() => Promise<void>>;
  refreshBorrowDataRef: IBorrowRef<() => Promise<void>>;
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
  const [borrowDataStatus, setBorrowDataStatus] = useState<EBorrowDataStatus>(
    EBorrowDataStatus.Idle,
  );
  const [pendingTxs, setPendingTxsState] = useState<IStakePendingTx[]>([]);
  const refreshReservesRef = borrowRefreshReservesRef;
  const refreshRewardsRef = useRef<(() => Promise<void>) | null>(null);
  const refreshBorrowDataRef = useRef<(() => Promise<void>) | null>(null);

  // Stable setter that won't cause unnecessary re-renders
  const setPendingTxs = useCallback((txs: IStakePendingTx[]) => {
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
      borrowDataStatus,
      setBorrowDataStatus,
      swapConfig,
      pendingTxs,
      setPendingTxs,
      refreshReservesRef,
      refreshRewardsRef,
      refreshBorrowDataRef,
    };
  }, [
    reserves,
    market,
    reservesLoading,
    borrowDataStatus,
    swapConfig,
    pendingTxs,
    setPendingTxs,
    refreshReservesRef,
    refreshRewardsRef,
    refreshBorrowDataRef,
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
