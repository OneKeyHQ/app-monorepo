import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useBtcMetadata } from './useBtcMetadata';

import type { IUseBtcMetadataResult } from './useBtcMetadata';

const BtcMetadataContext = createContext<IUseBtcMetadataResult | null>(null);

export function BtcMetadataProvider({ children }: { children: ReactNode }) {
  const value = useBtcMetadata();
  return (
    <BtcMetadataContext.Provider value={value}>
      {children}
    </BtcMetadataContext.Provider>
  );
}

export function useBtcMetadataContext(): IUseBtcMetadataResult | null {
  return useContext(BtcMetadataContext);
}
