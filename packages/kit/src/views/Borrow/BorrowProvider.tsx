import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

type IBorrowContextValue = {
  reserves: IBorrowReserveItem | null;
  setReserves: React.Dispatch<React.SetStateAction<IBorrowReserveItem | null>>;
  market: IBorrowMarketItem | null;
  setMarket: React.Dispatch<React.SetStateAction<IBorrowMarketItem | null>>;
  reservesLoading: boolean;
  setReservesLoading: React.Dispatch<React.SetStateAction<boolean>>;
};

const BorrowContext = createContext<IBorrowContextValue>(undefined as any);

export const BorrowProvider = ({
  children,
}: PropsWithChildren<{
  value?: IBorrowContextValue;
}>) => {
  const [reserves, setReserves] = useState<IBorrowReserveItem | null>(null);
  const [market, setMarket] = useState<IBorrowMarketItem | null>(null);
  const [reservesLoading, setReservesLoading] = useState(false);
  const contextValue = useMemo(() => {
    return {
      reserves,
      setReserves,
      market,
      setMarket,
      reservesLoading,
      setReservesLoading,
    };
  }, [
    reserves,
    setReserves,
    market,
    setMarket,
    reservesLoading,
    setReservesLoading,
  ]);

  return (
    <BorrowContext.Provider value={contextValue}>
      {children}
    </BorrowContext.Provider>
  );
};

export const useBorrowContext = () => useContext(BorrowContext);
