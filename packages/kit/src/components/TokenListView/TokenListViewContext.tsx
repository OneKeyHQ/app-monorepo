import { createContext, useContext } from 'react';

import type { IAccountToken } from '@onekeyhq/shared/types/token';

export interface ITokenListViewContextValue {
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
}

export const TokenListViewContext = createContext<ITokenListViewContextValue>({
  allAggregateTokenMap: {},
});

export const useTokenListViewContext = () => useContext(TokenListViewContext);
