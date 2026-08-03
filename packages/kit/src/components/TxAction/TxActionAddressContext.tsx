import { createContext, useContext } from 'react';

import type { IAddressBadge } from '@onekeyhq/shared/types/address';

const TxActionAddressMapContext = createContext<
  Record<string, IAddressBadge> | undefined
>(undefined);

const TxActionAddressMapProvider = TxActionAddressMapContext.Provider;

function useTxActionAddressMap() {
  return useContext(TxActionAddressMapContext);
}

export { TxActionAddressMapProvider, useTxActionAddressMap };
