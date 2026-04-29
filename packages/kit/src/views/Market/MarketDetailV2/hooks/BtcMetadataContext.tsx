import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useBtcMetadata } from './useBtcMetadata';

import type { IUseBtcMetadataResult } from './useBtcMetadata';

const BtcMetadataContext = createContext<IUseBtcMetadataResult | null>(null);

export function BtcMetadataProvider({ children }: { children: ReactNode }) {
  const value = useBtcMetadata();
  // Stable reference unless the underlying memoized result identity changes.
  const contextValue = useMemo(() => value, [value]);
  return (
    <BtcMetadataContext.Provider value={contextValue}>
      {children}
    </BtcMetadataContext.Provider>
  );
}

export function useBtcMetadataContext(): IUseBtcMetadataResult | null {
  return useContext(BtcMetadataContext);
}
