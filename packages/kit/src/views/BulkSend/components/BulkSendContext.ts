import { createContext, useContext } from 'react';

import type { IToken } from '@onekeyhq/shared/types/token';

export type IBulkSendContext = {
  selectedAccountId: string | undefined;
  setSelectedAccountId: (accountId: string | undefined) => void;
  selectedNetworkId: string | undefined;
  setSelectedNetworkId: (networkId: string | undefined) => void;
  selectedToken: IToken | undefined;
  setSelectedToken: (token: IToken | undefined) => void;
  selectedIndexedAccountId: string | undefined;
  setSelectedIndexedAccountId: (indexedAccountId: string | undefined) => void;
};
export const BulkSendContext = createContext<IBulkSendContext>({
  selectedAccountId: undefined,
  setSelectedAccountId: () => {},
  selectedNetworkId: undefined,
  setSelectedNetworkId: () => {},
  selectedToken: undefined,
  setSelectedToken: () => {},
  selectedIndexedAccountId: undefined,
  setSelectedIndexedAccountId: () => {},
});

export const useBulkSendContext = () => useContext(BulkSendContext);
