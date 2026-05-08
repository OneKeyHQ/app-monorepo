import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { flattenAggregateTokensMap } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextTokenList,
  withProvider: withTokenListProvider,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextTokenList,
  contextAtomMethod,
  withTokenListProvider,
};

export const { atom: searchTokenStateAtom, use: useSearchTokenStateAtom } =
  contextAtom<{
    isSearching: boolean;
  }>({
    isSearching: false,
  });

export const { atom: searchTokenListAtom, use: useSearchTokenListAtom } =
  contextAtom<{
    tokens: IAccountToken[];
  }>({
    tokens: [],
  });

export const { atom: allTokenListAtom, use: useAllTokenListAtom } =
  contextAtom<{
    tokens: IAccountToken[];
    keys: string;
    accountId?: string;
    networkId?: string;
  }>({
    tokens: [],
    keys: '',
    accountId: undefined,
    networkId: undefined,
  });

export const { atom: allTokenListMapAtom, use: useAllTokenListMapAtom } =
  contextAtom<{
    [key: string]: ITokenFiat;
  }>({});

export const { atom: tokenListAtom, use: useTokenListAtom } = contextAtom<{
  tokens: IAccountToken[];
  keys: string;
}>({
  tokens: [],
  keys: '',
});

export const { atom: riskyTokenListAtom, use: useRiskyTokenListAtom } =
  contextAtom<{
    riskyTokens: IAccountToken[];
    keys: string;
  }>({
    riskyTokens: [],
    keys: '',
  });

export const {
  atom: smallBalanceTokenListAtom,
  use: useSmallBalanceTokenListAtom,
} = contextAtom<{ smallBalanceTokens: IAccountToken[]; keys: string }>({
  smallBalanceTokens: [],
  keys: '',
});

export const {
  atom: activeAccountTokenListAtom,
  use: useActiveAccountTokenListAtom,
} = contextAtom<{ tokens: IAccountToken[]; keys: string }>({
  tokens: [],
  keys: '',
});

export const { atom: tokenListMapAtom, use: useTokenListMapAtom } =
  contextAtom<{
    [key: string]: ITokenFiat;
  }>({});

export const { atom: riskyTokenListMapAtom, use: useRiskyTokenListMapAtom } =
  contextAtom<{
    [key: string]: ITokenFiat;
  }>({});

export const {
  atom: smallBalanceTokenListMapAtom,
  use: useSmallBalanceTokenListMapAtom,
} = contextAtom<{
  [key: string]: ITokenFiat;
}>({});

export const {
  atom: smallBalanceTokensFiatValueAtom,
  use: useSmallBalanceTokensFiatValueAtom,
} = contextAtom<string>('0');

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');

export const { atom: tokenListStateAtom, use: useTokenListStateAtom } =
  contextAtom<{
    address: string;
    isRefreshing: boolean;
    initialized: boolean;
  }>({
    address: '',
    isRefreshing: true,
    initialized: false,
  });

export const {
  atom: aggregateTokensListMapAtom,
  use: useAggregateTokensListMapAtom,
} = contextAtom<
  Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >
>({});

export const { atom: aggregateTokensMapAtom, use: useAggregateTokensMapAtom } =
  contextAtom<{
    // aggregate token key
    [key: string]: {
      // networkId
      [key: string]: ITokenFiat;
    };
  }>({});

export const {
  atom: flattenAggregateTokensMapAtom,
  use: useFlattenAggregateTokensMapAtom,
} = contextAtomComputed<{
  [key: string]: ITokenFiat;
}>((get) => {
  const aggregateTokensMap = get(aggregateTokensMapAtom());
  return flattenAggregateTokensMap(aggregateTokensMap);
});

export const {
  atom: activeAccountTokenListStateAtom,
  use: useActiveAccountTokenListStateAtom,
} = contextAtom<{
  isRefreshing: boolean;
  initialized: boolean;
}>({
  isRefreshing: false,
  initialized: false,
});

export const { atom: createAccountStateAtom, use: useCreateAccountStateAtom } =
  contextAtom<{
    token: IAccountToken | null;
    isCreating: boolean;
  }>({
    token: null,
    isCreating: false,
  });

export const {
  atom: processingTokenStateAtom,
  use: useProcessingTokenStateAtom,
} = contextAtom<{
  token: IAccountToken | null;
  isProcessing: boolean;
}>({
  token: null,
  isProcessing: false,
});

export const { atom: tokenListSortAtom, use: useTokenListSortAtom } =
  contextAtom<{
    sortType: ETokenListSortType;
    sortDirection: 'desc' | 'asc';
  }>({
    sortType: ETokenListSortType.Value,
    sortDirection: 'desc',
  });

// Hard cap on how many `${accountId}__${networkId}` entries the per-owner
// cache may hold at once. Each entry persists into MMKV via `coldStartCache`,
// so an unbounded `byOwner` would steadily grow with the user's session
// history and slow down every cold-start hydration. 50 covers a typical HD
// wallet with ~5 active accounts × ~10 networks comfortably; older entries
// are dropped in MRU order on write (see TokenListView's setter).
export const RENDERED_TOKEN_LIST_CACHE_MAX_OWNERS = 50;

/**
 * Per-owner cache of the final rendered token list (after filtering
 * hideZeroBalance, hideDeFiMarked, etc.). Keyed by `${accountId}__${networkId}`.
 *
 * Stores both the rendered token list AND its `$key`→ITokenFiat balance/price
 * map so a network/account switch can hydrate `tokenListAtom` and
 * `tokenListMapAtom` together — otherwise the new owner's tokens render with
 * the previous owner's map (no balance, no price) until the async
 * `getAccountLocalTokens` fetch returns.
 *
 * Used for:
 *  1. Cold start: the last UI-visible list and its map are restored on next
 *     launch.
 *  2. Network/account switching within a session: `TokenListBlock` looks the
 *     entry up by current `${accountId}__${networkId}` and eagerly hydrates
 *     the singleton atoms before `initTokenListData`'s async fetch runs.
 *
 * Capacity is bounded — see `RENDERED_TOKEN_LIST_CACHE_MAX_OWNERS`. Writers
 * are responsible for MRU-evicting older entries before persisting.
 */
export const {
  atom: renderedTokenListCacheAtom,
  use: useRenderedTokenListCacheAtom,
} = contextAtom<{
  byOwner: Record<
    string,
    {
      tokens: IAccountToken[];
      // Optional in the read type because entries persisted by an earlier
      // build don't carry it. Fresh writes always include it.
      tokenListMap?: Record<string, ITokenFiat>;
      // Raw nested aggregate-token map (the source for
      // `flattenAggregateTokensMapAtom`). Cached so a paint-time hydrate can
      // restore aggregate-token balance/value alongside `tokenListMap` —
      // without this, rendering cached tokens against stale aggregate data
      // briefly mis-attributes balances after a network/account switch.
      // Optional because legacy entries persisted by an earlier build don't
      // carry it; legacy entries are skipped on the read side.
      aggregateTokensMap?: Record<string, Record<string, ITokenFiat>>;
      accountId: string;
      networkId: string;
    }
  >;
}>(
  { byOwner: {} },
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.renderedTokenListCacheAtom,
  },
);
