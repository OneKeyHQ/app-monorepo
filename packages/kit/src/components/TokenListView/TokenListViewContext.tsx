import { createContext, useContext } from 'react';

import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export interface ITokenListViewContextValue {
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  networksMap?: Record<string, IServerNetwork>;
  tokenListMap?: Record<string, ITokenFiat>;
  // TokenList SLC render binding (spec §5). When true, the per-key leaves
  // (Balance/Value/Price/PriceChange) read the per-store cell via
  // `useTokenFiat($key)` instead of the whole `tokenListMap`. Set ONLY on the
  // home path where the SLC producer (`useTokenListSlcProducer`) is mounted and
  // feeds the cells off the global `tokenListAtom`/`tokenListMapAtom`. The
  // TokenSelector / scoped-active-account / AssetList paths leave it false so
  // they keep reading `tokenListMap ?? globalMap` (spec §5: the seam holds for
  // the home path only — do NOT break TokenSelector).
  useCellSeam?: boolean;
}

export const TokenListViewContext = createContext<ITokenListViewContextValue>({
  allAggregateTokenMap: {},
  networksMap: undefined,
  tokenListMap: undefined,
  useCellSeam: false,
});

export const useTokenListViewContext = () => useContext(TokenListViewContext);
