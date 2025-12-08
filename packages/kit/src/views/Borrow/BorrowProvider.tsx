import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

type IBorrowContextValue = {
  reserves: IBorrowReserveItem | null;
  setReserves: React.Dispatch<React.SetStateAction<IBorrowReserveItem | null>>;
};

const BorrowContext = createContext<IBorrowContextValue>(undefined as any);

export const BorrowProvider = ({
  children,
}: PropsWithChildren<{
  value?: IBorrowContextValue;
}>) => {
  const [reserves, setReserves] = useState<IBorrowReserveItem | null>(null);
  const contextValue = useMemo(() => {
    return {
      reserves,
      setReserves,
    };
  }, [reserves, setReserves]);

  return (
    <BorrowContext.Provider value={contextValue}>
      {children}
    </BorrowContext.Provider>
  );
};

export const useBorrowContext = () => useContext(BorrowContext);
