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
    isInit,
    data,
  }: {
    accountId: string;
    isInit: boolean;
    data: IFetchTokenDetailItem;
  }) => void;
}

export const TokenDetailsContext = createContext<ITokenDetailsContextValue>({
  tokenMetadata: undefined,
  updateTokenMetadata: () => {},
  isLoadingTokenDetails: {},
  updateIsLoadingTokenDetails: () => {},
  tokenDetails: {},
  updateTokenDetails: () => {},
});

export const useTokenDetailsContext = () => useContext(TokenDetailsContext);
