import { createContext, useContext } from 'react';

export interface ITokenDetailsContextValue {
  tokenMetadata?: {
    price?: number;
    priceChange24h?: number;
    [key: string]: any;
  };
  updateTokenMetadata: (
    data: Partial<ITokenDetailsContextValue['tokenMetadata']>,
  ) => void;
}

export const TokenDetailsContext = createContext<ITokenDetailsContextValue>({
  tokenMetadata: undefined,
  updateTokenMetadata: () => {},
});

export const useTokenDetailsContext = () => useContext(TokenDetailsContext);
