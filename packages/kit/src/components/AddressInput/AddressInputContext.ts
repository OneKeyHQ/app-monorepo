import { createContext } from 'react';

import type { IAddressLookalikeCheck } from './types';

export const AddressInputContext = createContext<{
  networkId?: string;
  accountId?: string;
  name?: string;
  hideNonBackedUpWallet?: boolean;
  isLookalikeAddress?: IAddressLookalikeCheck;
}>({});
