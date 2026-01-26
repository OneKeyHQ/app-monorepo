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

  // Refs for external refresh triggers (used by Overview component)
  refreshRewardsRef: React.MutableRefObject<(() => Promise<void>) | null>;
  refreshBorrowDataRef: React.MutableRefObject<(() => Promise<void>) | null>;
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

  // Refs for external refresh triggers
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
      refreshRewardsRef,
      refreshBorrowDataRef,
    }),
    [
      market,
      earnAccount,
      reserves,
      borrowDataStatus,
      swapConfig,
      pendingTxs,
      setPendingTxs,
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
