import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

const HoldersLayoutContext = createContext({
  width: 0,
  setWidth: (_width: number) => {},
});

export function HoldersLayoutProvider({ children }: PropsWithChildren) {
  const [width, setWidth] = useState(0);
  const value = useMemo(() => ({ width, setWidth }), [width]);
  return (
    <HoldersLayoutContext.Provider value={value}>
      {children}
    </HoldersLayoutContext.Provider>
  );
}

export const useHoldersWidth = () => useContext(HoldersLayoutContext);
