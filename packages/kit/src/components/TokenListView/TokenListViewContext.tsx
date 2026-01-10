import { createContext, useContext } from 'react';

import type { IAccountToken } from '@onekeyhq/shared/types/token';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export interface ITokenListViewContextValue {
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  networksMap?: Record<string, IServerNetwork>;
}

export const TokenListViewContext = createContext<ITokenListViewContextValue>({
  allAggregateTokenMap: {},
  networksMap: undefined,
});

export const useTokenListViewContext = () => useContext(TokenListViewContext);
