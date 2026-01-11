import { createContext, useContext } from 'react';

import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export type IBulkSendContext = {
  selectedAccountId: string | undefined;
  setSelectedAccountId: (accountId: string | undefined) => void;
  selectedNetworkId: string | undefined;
  setSelectedNetworkId: (networkId: string | undefined) => void;
  selectedToken: IToken | undefined;
  setSelectedToken: (token: IToken | undefined) => void;
  selectedIndexedAccountId: string | undefined;
  setSelectedIndexedAccountId: (indexedAccountId: string | undefined) => void;
  selectedTokenDetail: ({ info: IToken } & ITokenFiat) | undefined;
  setSelectedTokenDetail: (
    tokenDetail: ({ info: IToken } & ITokenFiat) | undefined,
  ) => void;
  tokenDetailsState: {
    initialized: boolean;
    isRefreshing: boolean;
  };
  setTokenDetailsState: (state: {
    initialized: boolean;
    isRefreshing: boolean;
  }) => void;
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
  selectedTokenDetail: undefined,
  setSelectedTokenDetail: () => {},
  tokenDetailsState: {
    initialized: false,
    isRefreshing: false,
  },
  setTokenDetailsState: () => {},
});

export const useBulkSendContext = () => useContext(BulkSendContext);
