import type { IListStructure } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/types';
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
  useContextData: useTokenListContextData,
} = createJotaiContext();
export {
  ProviderJotaiContextTokenList,
  contextAtomMethod,
  withTokenListProvider,
  // Exposes the per-store handle for the SLC cell seam (slc/projection.ts,
  // slc/useTokenFiat.ts). Other consumers should keep using the typed
  // `use*Atom` hooks.
  useTokenListContextData,
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

/**
 * TokenList SLC — structure atom (spec §3, Phase-1 Slice 1).
 *
 * Lives in the existing per-store contextAtom store. Holds ONLY the ids +
 * aggregate membership + owner/generation; per-key fiat/meta VALUES live in
 * the cells registered in `storeProjection` (slc/projection.ts). Price ticks
 * write cells and do NOT touch this atom — that low frequency is the premise
 * of "only the changed leaf re-renders" (spec §4.1, §5).
 *
 * Written exclusively via `applyStructureSnapshot` (slc/projection.ts); never
 * set directly by components (spec §4.1).
 */
export const { atom: listStructureAtom, use: useListStructureAtom } =
  contextAtom<IListStructure>({
    orderedIds: [],
    smallBalanceIds: [],
    nonZeroIds: [],
    aggMembership: {},
    ownerKey: '',
    generation: -1,
  });

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
 * ROLE (post TokenList SLC §7 migration): this atom is now IN-MEMORY ONLY (no
 * `coldStartCache`). It serves ONLY the in-session network/account SWITCH
 * eager-hydrate (`TokenListBlock` looks the entry up by current
 * `${accountId}__${networkId}` and hydrates the singleton atoms before
 * `initTokenListData`'s async fetch runs; `TokenListView`'s effect MRU-writes
 * it). The COLD-START persisted role (role-1) is replaced by the slim bundle
 * (slc/coldStart.ts, key `ctx:tokenListSlimColdCache`). Dropping
 * `coldStartCache` here is what stops the OLD `ctx:renderedTokenListCacheAtom`
 * key from re-entering `coldStartValuesMap` on the new build — the root cause
 * of the double-authority revival (memory
 * reference_coldstart_cache_double_authority). The byOwner shape and BOTH call
 * sites stay intact, so switch-hydrate is unaffected; the in-memory MRU map is
 * rebuilt within the session as the user navigates and survives
 * PortfolioContainer remounts via the singleton store.
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
}>({ byOwner: {} });
