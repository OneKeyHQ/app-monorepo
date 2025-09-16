import { createContext, useContext } from 'react';

import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

export interface ITokenDetailsContextValue {
  tokenMetadata?: {
    price?: number;
    priceChange24h?: number;
    coingeckoId?: string;
  };
  updateTokenMetadata: (
    data: Partial<ITokenDetailsContextValue['tokenMetadata']>,
  ) => void;

  tokenDetails: Record<
    string,
    {
      init: boolean;
      data?: IFetchTokenDetailItem;
    }
  >;
  isLoadingTokenDetails?: Record<string, boolean>;
  updateIsLoadingTokenDetails: ({
    accountId,
    isLoading,
  }: {
    accountId: string;
    isLoading: boolean;
  }) => void;
  updateTokenDetails: ({
    accountId,
    networkId,
    isInit,
    data,
  }: {
    accountId: string;
    networkId: string;
    isInit: boolean;
    data: IFetchTokenDetailItem;
  }) => void;
  batchUpdateTokenDetails: (
    details: {
      accountId: string;
      networkId: string;
      isInit: boolean;
      data: IFetchTokenDetailItem;
    }[],
  ) => void;
}

export const TokenDetailsContext = createContext<ITokenDetailsContextValue>({
  tokenMetadata: undefined,
  updateTokenMetadata: () => {},
  isLoadingTokenDetails: {},
  updateIsLoadingTokenDetails: () => {},
  tokenDetails: {},
  updateTokenDetails: () => {},
  batchUpdateTokenDetails: () => {},
});

export const useTokenDetailsContext = () => useContext(TokenDetailsContext);
