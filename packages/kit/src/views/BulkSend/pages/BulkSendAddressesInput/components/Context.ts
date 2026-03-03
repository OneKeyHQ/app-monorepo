import { createContext, useContext } from 'react';

import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export type ITokenDetailsState = {
  initialized: boolean;
  isRefreshing: boolean;
};

export type IBulkSendAddressesInputContext = {
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
  tokenDetailsState: ITokenDetailsState;
  setTokenDetailsState: (
    state:
      | ITokenDetailsState
      | ((prev: ITokenDetailsState) => ITokenDetailsState),
  ) => void;
  bulkSendMode: EBulkSendMode;
  setBulkSendMode: (bulkSendMode: EBulkSendMode) => void;
};
export const BulkSendAddressesInputContext =
  createContext<IBulkSendAddressesInputContext>({
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
    bulkSendMode: EBulkSendMode.OneToMany,
    setBulkSendMode: () => {},
  });

export const useBulkSendAddressesInputContext = () =>
  useContext(BulkSendAddressesInputContext);
