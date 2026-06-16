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
  // Per-$key OWNED aggregate sub-token METADATA map (same value shape as
  // `allAggregateTokenMap` and the legacy `aggregateTokensListMapAtom`
  // entries). The TokenListView host fills this so the per-key leaves
  // (TokenIconView / TokenNameView / TokenActionsView) resolve their
  // `aggregateTokenList` from context instead of importing the atom directly
  // (tokenList cells full-delete plan, PR-1). INTERIM: the host mirrors the
  // still-living `aggregateTokensListMapAtom` into this field; PR-3/PR-7 swap
  // the source to the cells producer payload.
  ownedAggregateTokenListMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  networksMap?: Record<string, IServerNetwork>;
  tokenListMap?: Record<string, ITokenFiat>;
  // Per-$key AGGREGATE fiat map (sum-of-subcells shape, `ITokenFiat`). Distinct
  // from `ownedAggregateTokenListMap` above, which carries aggregate sub-token
  // METADATA (the nested `{ tokens }` list); this carries the FLATTENED
  // aggregate FIAT a row renders. The host fills it on the NON-cell paths only
  // so the per-key leaves (Balance/Value/Price/PriceChange) resolve aggregate
  // fiat from context instead of reading `flattenAggregateTokensMapAtom`
  // directly (tokenList cells full-delete plan, PR-6). On the HOME cell path it is
  // unused — the leaves take `aggCell` via `useTokenFiat`. INTERIM for the
  // AssetList isolated store: the host mirrors that store's
  // `flattenAggregateTokensMapAtom`; PR-7 moves AssetList onto the cell seam and
  // retires this fill.
  aggregateTokenFiatMap?: Record<string, ITokenFiat>;
  // TokenList cells render binding (spec §5). When true, the per-key leaves
  // (Balance/Value/Price/PriceChange) read the per-store cell via
  // `useTokenFiat($key)` instead of the whole `tokenListMap`. Set ONLY on the
  // home path where the cells producer (`useTokenListCellsProducer`) is mounted and
  // feeds the cells off the global `tokenListAtom`/`tokenListMapAtom`. The
  // TokenSelector / scoped-active-account / AssetList paths leave it false so
  // they keep reading `tokenListMap ?? globalMap` (spec §5: the seam holds for
  // the home path only — do NOT break TokenSelector).
  useCellSeam?: boolean;
}

export const TokenListViewContext = createContext<ITokenListViewContextValue>({
  allAggregateTokenMap: {},
  ownedAggregateTokenListMap: {},
  networksMap: undefined,
  tokenListMap: undefined,
  aggregateTokenFiatMap: undefined,
  useCellSeam: false,
});

export const useTokenListViewContext = () => useContext(TokenListViewContext);
