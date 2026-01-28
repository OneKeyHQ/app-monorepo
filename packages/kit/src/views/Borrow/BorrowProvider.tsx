import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

// Unified async data type for all requests
export type IAsyncData<T> = {
  data: T;
  loading: boolean;
  refresh: () => Promise<void>;
};

export type IBorrowEarnAccount = {
  walletId?: string;
  accountId?: string;
  networkId?: string;
  accountAddress?: string;
  account?: {
    id: string;
    indexedAccountId?: string;
    pub?: string;
  };
} | null;

const defaultAsyncData = <T,>(data: T): IAsyncData<T> => ({
  data,
  loading: false,
  refresh: () => Promise.resolve(),
});

type IBorrowContextValue = {
  // Market (sync data)
  market: IBorrowMarketItem | null;
  setMarket: React.Dispatch<React.SetStateAction<IBorrowMarketItem | null>>;

  // Async data requests - unified format
  earnAccount: IAsyncData<IBorrowEarnAccount>;
  setEarnAccount: React.Dispatch<
    React.SetStateAction<IAsyncData<IBorrowEarnAccount>>
  >;

  reserves: IAsyncData<IBorrowReserveItem | null>;
  setReserves: React.Dispatch<
    React.SetStateAction<IAsyncData<IBorrowReserveItem | null>>
  >;

  // Other state
  borrowDataStatus: EBorrowDataStatus;
  setBorrowDataStatus: React.Dispatch<React.SetStateAction<EBorrowDataStatus>>;
  swapConfig: ISwapConfig;
  pendingTxs: IStakePendingTx[];
  setPendingTxs: (txs: IStakePendingTx[]) => void;

  // Refresh function for external triggers (set by Overview, used by BorrowPendingBridge)
  refreshAllBorrowData: () => Promise<void>;
  setRefreshAllBorrowData: (fn: () => Promise<void>) => void;
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
  const [market, setMarket] = useState<IBorrowMarketItem | null>(null);
  const [earnAccount, setEarnAccount] = useState<
    IAsyncData<IBorrowEarnAccount>
  >(defaultAsyncData(null));
  const [reserves, setReserves] = useState<
    IAsyncData<IBorrowReserveItem | null>
  >(defaultAsyncData(null));
  const [borrowDataStatus, setBorrowDataStatus] = useState<EBorrowDataStatus>(
    EBorrowDataStatus.Idle,
  );
  const [pendingTxs, setPendingTxsState] = useState<IStakePendingTx[]>([]);

  // Refresh function for external triggers
  const [refreshAllBorrowData, setRefreshAllBorrowDataState] = useState<
    () => Promise<void>
  >(() => () => Promise.resolve());

  // Stable setter that won't cause unnecessary re-renders
  const setRefreshAllBorrowData = useCallback((fn: () => Promise<void>) => {
    setRefreshAllBorrowDataState(() => fn);
  }, []);

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

  const contextValue = useMemo(
    () => ({
      market,
      setMarket,
      earnAccount,
      setEarnAccount,
      reserves,
      setReserves,
      borrowDataStatus,
      setBorrowDataStatus,
      swapConfig,
      pendingTxs,
      setPendingTxs,
      refreshAllBorrowData,
      setRefreshAllBorrowData,
    }),
    [
      market,
      earnAccount,
      reserves,
      borrowDataStatus,
      swapConfig,
      pendingTxs,
      setPendingTxs,
      refreshAllBorrowData,
      setRefreshAllBorrowData,
    ],
  );

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
