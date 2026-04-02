import { createContext } from 'react';

export const AddressInputContext = createContext<{
  networkId?: string;
  accountId?: string;
  name?: string;
  hideNonBackedUpWallet?: boolean;
}>({});
