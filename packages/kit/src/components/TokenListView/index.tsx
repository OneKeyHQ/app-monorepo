import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  type IYStackProps,
  ListView,
  SizableText,
  Stack,
  Tabs,
  XStack,
  YStack,
  useStyle,
} from '@onekeyhq/components';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isTokenSelectorDappToken } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  buildHomeDefaultTokenMapKey,
  getFilteredTokenBySearchKey,
  sortTokensByFiatValue,
  sortTokensByName,
  sortTokensByPrice,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IExchangeFilter } from '@onekeyhq/shared/types/exchange';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';
import type {
  IAccountToken,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  RENDERED_TOKEN_LIST_CACHE_MAX_OWNERS,
  useActiveAccountTokenListAtom,
  useActiveAccountTokenListStateAtom,
  useAggregateTokensListMapAtom,
  useAggregateTokensMapAtom,
  useAllTokenListAtom,
  useFlattenAggregateTokensMapAtom,
  useListStructureAtom,
  useRenderedTokenListCacheAtom,
  useSearchKeyAtom,
  useSearchTokenListAtom,
  useSearchTokenStateAtom,
  useSmallBalanceTokenListAtom,
  useTokenListAtom,
  useTokenListContextData,
  useTokenListMapAtom,
  useTokenListSortAtom,
  useTokenListStateAtom,
} from '../../states/jotai/contexts/tokenList';
import {
  aggCell,
  cell,
  hasActiveScopedOverride,
  isAgg,
  meta as metaCell,
  projectHomeDisplayIds,
  resolveUseCellSeam,
} from '../../states/jotai/contexts/tokenList/slc';
import { useTokenManagement } from '../../views/AssetList/hooks/useTokenManagement';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import { EmptySearch } from '../Empty';
import { EmptyToken } from '../Empty/EmptyToken';
import { ListLoading } from '../Loading';

import { perfTokenListView } from './perfTokenListView';
import { TokenListFooter } from './TokenListFooter';
import { TokenListHeader } from './TokenListHeader';
import { TokenListItem } from './TokenListItem';
import {
  TokenListViewContext,
  useTokenListViewContext,
} from './TokenListViewContext';
import { getTokenListOwnerCacheAccountId } from './utils';

import type {
  IScopedActiveTokenList,
  IScopedActiveTokenListState,
} from '../TokenSelectorFilter/utils';

// Stable module-level empty defaults so the PR-3 selector branches don't hand a
// fresh `{}` to `useMemo` deps every render (would defeat memoization).
const EMPTY_FIAT_MAP: Record<string, ITokenFiat> = {};
const EMPTY_AGGREGATE_MAP: Record<string, { tokens: IAccountToken[] }> = {};

type IProps = {
  accountId: string;
  networkId: string;
  indexedAccountId: string | undefined;
  // When true, the per-owner rendered cache is keyed by `indexedAccountId`
  // instead of `accountId` so the same logical owner survives derive-type
  // switches in merge mode. Mirrors the read-side rule in TokenListBlock's
  // useLayoutEffect cache hydrator.
  mergeDeriveAddressData?: boolean;
  tableLayout?: boolean;
  onPressToken?: (token: IAccountToken) => void;
  withHeader?: boolean;
  withFooter?: boolean;
  withPrice?: boolean;
  withNetwork?: boolean;
  withSmallBalanceTokens?: boolean;
  withSwapAction?: boolean;
  inTabList?: boolean;
  onManageToken?: () => void;
  manageTokenEnabled?: boolean;
  isAllNetworks?: boolean;
  searchAll?: boolean;
  footerTipText?: string;
  hideValue?: boolean;
  hideBalanceAndValue?: boolean;
  isTokenSelector?: boolean;
  tokenSelectorSearchKey?: string;
  tokenSelectorSearchTokenState?: {
    isSearching: boolean;
  };
  tokenSelectorSearchTokenList?: {
    tokens: IAccountToken[];
    searchKey?: string;
  };
  emptyAccountView?: ReactNode;
  showActiveAccountTokenList?: boolean;
  scopedActiveAccountTokenList?: IScopedActiveTokenList;
  scopedActiveAccountTokenListState?: IScopedActiveTokenListState;
  scopedActiveAccountTokenListMap?: Record<string, ITokenFiat>;
  // TokenSelector self-fetched data threaded as props (tokenList SLC
  // full-delete plan, PR-3). Consumed ONLY on the `isTokenSelector` branch so
  // the selector no longer reads `tokenListAtom`/`tokenListMapAtom`/
  // `smallBalanceTokenListAtom`/`aggregateTokensListMapAtom` for its display
  // path. The home + active-account branches keep reading the atoms.
  tokenSelectorTokenList?: {
    tokens: IAccountToken[];
    smallBalanceTokens: IAccountToken[];
  };
  // Fiat map for selector rows (hideZero / exchange filters) and the
  // network-search `tokenFiatMap`.
  tokenSelectorTokenListMap?: Record<string, ITokenFiat>;
  // Scoped owned-aggregate sub-token list map (replaces the §5
  // `localAggregateTokensListMap` atom read on the selector / network-search
  // path; also feeds `ownedAggregateTokenListMap` context for badges).
  tokenSelectorAggregateTokenListMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  // PR-3: `false` until TokenSelector's self-fetch `usePromiseResult` resolves
  // the first time. On the `isTokenSelector` branch the displayed list comes
  // from `tokenSelectorTokenList` (props) which starts empty, but the home
  // mirror keeps `tokenListState.initialized === true`, so without this flag
  // the selector would render EmptyToken for a frame before the self-fetch
  // lands. We gate the selector skeleton + cold-start fallback on this so the
  // selector shows a SKELETON (or its per-owner cached list) until ready,
  // matching the pre-PR-3 instant render. The active-account branch is
  // unaffected (it uses `activeAccountTokenListState`).
  tokenSelectorInitialized?: boolean;
  onRefresh?: () => void;
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
  showNetworkIcon?: boolean;
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  hideZeroBalanceTokens?: boolean;
  hideDeFiMarkedTokens?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  keepDefaultZeroBalanceTokens?: boolean;
  withAggregateBadge?: boolean;
  emptyProps?: IYStackProps;
  searchKeyLengthThreshold?: number;
  plainMode?: boolean;
  limit?: number;
  deferTokenManagement?: boolean;
  exchangeFilter?: IExchangeFilter;
  testID?: string;
  // Scene prefix forwarded to each TokenListItem so callers (Home,
  // AssetList, TokenSelector, …) produce unique testIDs instead of every
  // scene reusing the shared component's default `home-token-item-*` prefix.
  tokenItemTestIDPrefix?: string;
  // TokenList SLC render binding (spec §5). Opt-in flag set ONLY by the home
  // `TokenListBlock`, where `useTokenListSlcProducer` is mounted and feeds the
  // per-key cells off the global `tokenListAtom`/`tokenListMapAtom`. When true
  // AND the list is rendering the global (non-selector, non-scoped) map, the
  // per-key leaves subscribe to their cell via `useTokenFiat($key)`. Other
  // callers (AssetList, TokenSelector) leave it unset so leaves keep reading
  // the whole `tokenListMap` (cells are empty without a producer).
  enableCellSeam?: boolean;
};

function TokenListViewCmp(props: IProps) {
  const {
    onPressToken,
    tableLayout,
    withHeader,
    withFooter,
    withPrice,
    inTabList = false,
    withNetwork,
    withSwapAction,
    onManageToken,
    manageTokenEnabled,
    isAllNetworks,
    searchAll,
    isTokenSelector,
    footerTipText,
    hideValue,
    hideBalanceAndValue,
    tokenSelectorSearchKey = '',
    tokenSelectorSearchTokenState = { isSearching: false },
    tokenSelectorSearchTokenList = { tokens: [], searchKey: '' },
    emptyAccountView,
    showActiveAccountTokenList = false,
    listViewStyleProps,
    onRefresh,
    showNetworkIcon,
    allAggregateTokenMap,
    hideZeroBalanceTokens,
    hideDeFiMarkedTokens,
    homeDefaultTokenMap,
    keepDefaultZeroBalanceTokens = true,
    withAggregateBadge,
    emptyProps,
    accountId,
    networkId,
    indexedAccountId,
    mergeDeriveAddressData,
    searchKeyLengthThreshold,
    plainMode,
    limit,
    deferTokenManagement,
    exchangeFilter,
    testID,
    tokenItemTestIDPrefix,
    scopedActiveAccountTokenListMap,
    tokenSelectorTokenList,
    tokenSelectorTokenListMap,
    tokenSelectorAggregateTokenListMap,
    tokenSelectorInitialized,
  } = props;

  const intl = useIntl();

  const [overFlowState, setOverFlowState] = useState<{
    isOverflow: boolean;
    isSliced: boolean;
  }>({
    isOverflow: false,
    isSliced: true,
  });

  const [activeAccountTokenListAtomValue] = useActiveAccountTokenListAtom();
  const [tokenList] = useTokenListAtom();
  const [allTokenList] = useAllTokenListAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const [aggregateTokenMap] = useFlattenAggregateTokensMapAtom();
  // Raw nested aggregate-token map — persisted alongside `tokenListMap` so
  // a paint-time hydrate can restore aggregate-token balance/value together
  // with the regular token map.
  const [rawAggregateTokensMap] = useAggregateTokensMapAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const [renderedTokenListCache, setRenderedTokenListCache] =
    useRenderedTokenListCacheAtom();
  // Use ref to avoid useMemo→useEffect→setState cycle
  const renderedTokenListCacheRef = useRef(renderedTokenListCache);
  renderedTokenListCacheRef.current = renderedTokenListCache;
  const [activeAccountTokenListStateAtomValue] =
    useActiveAccountTokenListStateAtom();
  const activeAccountTokenList =
    props.scopedActiveAccountTokenList ?? activeAccountTokenListAtomValue;
  const activeAccountTokenListState =
    props.scopedActiveAccountTokenListState ??
    activeAccountTokenListStateAtomValue;
  // An empty scoped map (`{}`, the default home state) is NOT an override —
  // fall back to the whole `tokenListMap` so the legacy / scoped path reads
  // real fiat. Only a POPULATED scoped LP map overrides (LP-dapp mode).
  const activeAccountTokenListMap = hasActiveScopedOverride(
    scopedActiveAccountTokenListMap,
  )
    ? (scopedActiveAccountTokenListMap ?? tokenListMap)
    : tokenListMap;
  // Selector fiat map (tokenList SLC full-delete plan, PR-3): on the selector
  // path the displayed list + fiat map are self-fetched by TokenSelector and
  // threaded as props, so the selector no longer reads the home `tokenListMap`
  // atom. The active-account scoped branch (LP-dapp / cross-account view) keeps
  // its own scoped map and is unaffected.
  const selectorFiatMap = useMemo(
    () => tokenSelectorTokenListMap ?? EMPTY_FIAT_MAP,
    [tokenSelectorTokenListMap],
  );
  // Priority: active-account scoped map (LP-dapp / cross-account, used by both
  // home AND selector) wins; then the selector's self-fetched map; then the
  // home `tokenListMap` atom.
  let visibleTokenListMap = tokenListMap;
  if (showActiveAccountTokenList) {
    visibleTokenListMap = activeAccountTokenListMap;
  } else if (isTokenSelector) {
    visibleTokenListMap = selectorFiatMap;
  }

  const tokenManagementEnabled =
    !deferTokenManagement || tokenListState.initialized;
  const { customTokens } = useTokenManagement({
    accountId,
    networkId,
    indexedAccountId,
    enabled: tokenManagementEnabled,
  });

  // The token list atoms are scoped to a singleton store, so they survive the
  // PortfolioContainer remount that fires on every account/network switch and
  // briefly carry the previous owner's data. When the loaded data does not
  // belong to the current accountId/networkId, prefer the per-owner rendered
  // cache for the current owner if it exists (instant swap, no skeleton);
  // otherwise return an empty list so the skeleton (gated below) covers the
  // gap until `initTokenListData` completes.
  const ownerMismatch =
    !!accountId &&
    !!networkId &&
    !!allTokenList.accountId &&
    !!allTokenList.networkId &&
    (allTokenList.accountId !== accountId ||
      allTokenList.networkId !== networkId);

  // Owner-aware cache key: in merge mode, keyed by indexedAccountId so the
  // logical owner survives derive-type switches that change accountId.
  // Read in TokenListBlock's pre-paint hydrate uses the same rule.
  const ownerCacheAccountId = getTokenListOwnerCacheAccountId({
    accountId,
    indexedAccountId,
    mergeDeriveAddressData,
  });
  const ownerCacheKey =
    ownerCacheAccountId && networkId
      ? `${ownerCacheAccountId}__${networkId}`
      : '';

  const tokens = useMemo(() => {
    if (ownerMismatch && !showActiveAccountTokenList) {
      const cached =
        ownerCacheKey &&
        renderedTokenListCacheRef.current.byOwner?.[ownerCacheKey];
      // Require a paired `tokenListMap` — otherwise we'd render tokens
      // against the previous owner's map (no balance/price). Legacy cache
      // entries from an earlier build don't carry it; treat them as misses.
      if (cached && cached.tokens.length > 0 && cached.tokenListMap) {
        return cached.tokens;
      }
      return [];
    }

    let resultTokens: IAccountToken[] = [];
    if (showActiveAccountTokenList) {
      resultTokens = activeAccountTokenList.tokens;
    } else if (isTokenSelector) {
      // PR-3: the selector list is self-fetched by TokenSelector and threaded
      // as props (no longer the home `tokenListAtom`/`smallBalanceTokenListAtom`).
      resultTokens = (tokenSelectorTokenList?.tokens ?? []).concat(
        tokenSelectorTokenList?.smallBalanceTokens ?? [],
      );
    } else if (searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH) {
      resultTokens = tokenList.tokens.concat(
        smallBalanceTokenList.smallBalanceTokens,
      );
    } else {
      resultTokens = tokenList.tokens;
    }

    if (hideZeroBalanceTokens) {
      resultTokens = resultTokens.filter((item) => {
        const tokenBalance = new BigNumber(
          visibleTokenListMap[item.$key]?.balance ??
            aggregateTokenMap[item.$key]?.balance ??
            0,
        );

        if (tokenBalance.gt(0)) {
          return true;
        }

        if (keepDefaultZeroBalanceTokens) {
          if (
            homeDefaultTokenMap?.[
              buildHomeDefaultTokenMapKey({
                networkId: item.networkId ?? '',
                symbol: item.commonSymbol ?? item.symbol ?? '',
              })
            ] &&
            (item.isNative || item.isAggregateToken)
          ) {
            return true;
          }

          if (
            customTokens?.find(
              (t) =>
                t.$key === item.$key ||
                (t.address.toLowerCase() === item.address.toLowerCase() &&
                  t.networkId === item.networkId),
            )
          ) {
            return true;
          }
        }

        return false;
      });
    }

    if (hideDeFiMarkedTokens) {
      resultTokens = resultTokens.filter(
        (item) => !isTokenSelectorDappToken(item),
      );
    }

    if (exchangeFilter?.supportedAssets) {
      resultTokens = resultTokens.filter((item) => {
        const symbolUpper = (
          item.commonSymbol ??
          item.symbol ??
          ''
        ).toUpperCase();

        if (item.isAggregateToken) {
          return Object.values(exchangeFilter.supportedAssets).some(
            (networkAssets) =>
              networkAssets[symbolUpper]?.withdrawEnable === true,
          );
        }

        const networkAssets =
          exchangeFilter.supportedAssets[item.networkId ?? ''];
        return networkAssets?.[symbolUpper]?.withdrawEnable === true;
      });
    }

    // Cold-start fallback: when atoms haven't loaded yet for the current
    // owner, reuse the per-owner cache so the user sees their last known list
    // immediately. Read from ref to avoid useMemo→useEffect→setState cycle.
    // PR-3: on the selector path the displayed list is the self-fetched
    // `tokenSelectorTokenList` (props), NOT the home atoms, so `initialized`
    // here means "selector self-fetch resolved". The home mirror keeps
    // `tokenListState.initialized === true`, so gate on `tokenSelectorInitialized`
    // for the selector branch to keep the cache fallback firing pre-fetch.
    const notYetInitialized =
      isTokenSelector && !showActiveAccountTokenList
        ? !tokenSelectorInitialized
        : !tokenListState.initialized;
    if (
      !showActiveAccountTokenList &&
      resultTokens.length === 0 &&
      notYetInitialized
    ) {
      const cached =
        ownerCacheKey &&
        renderedTokenListCacheRef.current.byOwner?.[ownerCacheKey];
      if (cached && cached.tokens.length > 0 && cached.tokenListMap) {
        return cached.tokens;
      }
    }

    return resultTokens;
  }, [
    ownerMismatch,
    ownerCacheKey,
    showActiveAccountTokenList,
    isTokenSelector,
    searchKey,
    hideZeroBalanceTokens,
    hideDeFiMarkedTokens,
    activeAccountTokenList.tokens,
    tokenList.tokens,
    smallBalanceTokenList.smallBalanceTokens,
    tokenSelectorTokenList,
    tokenSelectorInitialized,
    visibleTokenListMap,
    aggregateTokenMap,
    keepDefaultZeroBalanceTokens,
    homeDefaultTokenMap,
    customTokens,
    exchangeFilter,
    tokenListState.initialized,
  ]);

  // Persist the rendered token list (and its balance/price map) per owner.
  // Skip when the loaded atoms are still showing a previous owner's data
  // (ownerMismatch) — otherwise we'd overwrite the target owner's cache with
  // stale tokens.
  useEffect(() => {
    if (
      !showActiveAccountTokenList &&
      !ownerMismatch &&
      ownerCacheKey &&
      tokens.length > 0 &&
      tokenListState.initialized &&
      !tokenListState.isRefreshing &&
      accountId &&
      networkId
    ) {
      setRenderedTokenListCache((prev) => {
        // `prev` may be in the legacy single-entry shape persisted by an
        // earlier build (`{ tokens, initialized, accountId, networkId }`).
        // Tolerate it defensively and lift it into `byOwner` so the user's
        // cold-start cache survives the upgrade. Without this migration,
        // first launch on the new build silently discards the old entry.
        const legacy = prev as unknown as {
          byOwner?: Record<
            string,
            {
              tokens: IAccountToken[];
              tokenListMap?: Record<string, ITokenFiat>;
              aggregateTokensMap?: Record<string, Record<string, ITokenFiat>>;
              accountId: string;
              networkId: string;
            }
          >;
          tokens?: IAccountToken[];
          initialized?: boolean;
          accountId?: string;
          networkId?: string;
        };
        // Object spread tolerates `undefined` (treats it as no-op) — no
        // explicit `?? {}` needed.
        const nextByOwner: NonNullable<typeof legacy.byOwner> = {
          ...legacy.byOwner,
        };
        if (
          !legacy.byOwner &&
          legacy.initialized &&
          legacy.tokens?.length &&
          legacy.accountId &&
          legacy.networkId
        ) {
          const legacyKey = `${legacy.accountId}__${legacy.networkId}`;
          if (!nextByOwner[legacyKey]) {
            // No `tokenListMap` in legacy entries; downstream guards skip
            // such entries until a fresh write replaces them.
            nextByOwner[legacyKey] = {
              tokens: legacy.tokens,
              accountId: legacy.accountId,
              networkId: legacy.networkId,
            };
          }
        }

        // MRU re-insertion: delete first so the spread below puts the
        // current owner at the end of the key order. Combined with the
        // size cap below, this keeps the most recently used entries.
        delete nextByOwner[ownerCacheKey];
        nextByOwner[ownerCacheKey] = {
          tokens,
          tokenListMap,
          // Persist the raw aggregate-token map alongside `tokenListMap`
          // so the read-side hydrate can refresh `aggregateTokensMapAtom`
          // atomically — without it, cached tokens render with the
          // previous owner's aggregate balance/value briefly.
          aggregateTokensMap: rawAggregateTokensMap,
          accountId,
          networkId,
        };

        const keys = Object.keys(nextByOwner);
        if (keys.length > RENDERED_TOKEN_LIST_CACHE_MAX_OWNERS) {
          // `Object.keys` preserves insertion order for string keys that
          // aren't integer indices. `accountId__networkId` always contains
          // non-digit chars (the `__` separator and id prefixes like
          // `hd-`), so dropping from the front evicts the oldest entries.
          const dropCount = keys.length - RENDERED_TOKEN_LIST_CACHE_MAX_OWNERS;
          for (let i = 0; i < dropCount; i += 1) {
            delete nextByOwner[keys[i]];
          }
        }

        return { byOwner: nextByOwner };
      });
    }
  }, [
    ownerMismatch,
    ownerCacheKey,
    showActiveAccountTokenList,
    tokens,
    tokenListMap,
    rawAggregateTokensMap,
    tokenListState.initialized,
    tokenListState.isRefreshing,
    setRenderedTokenListCache,
    accountId,
    networkId,
  ]);

  const [searchTokenState] = useSearchTokenStateAtom();

  const [searchTokenList] = useSearchTokenListAtom();

  const [{ sortType, sortDirection }] = useTokenListSortAtom();

  const { networksMap, useCellSeam } = useTokenListViewContext();
  // HOME projection path marker — read the SAME context flag the leaves read so
  // home/leaf agree (spec §5, PR-S). The wrapper computes
  // `useCellSeam = enableCellSeam && !isTokenSelector &&
  // !showActiveAccountTokenList && !scopedActiveAccountTokenListMap`; the inner
  // cmp reads it here rather than recomputing divergently.
  const isHomeProjectionPath = !!useCellSeam;
  // The per-store cell registry handle — used for NON-REACTIVE per-id cell/meta
  // reads inside the displayIds projection (store.get, NOT useAtomValue) so a
  // price tick that only writes a cell does not re-run the projection memo
  // (spec §11.4 risk #9). `store` is always defined when a list store is
  // mounted (home always has one).
  const { store: tokenListStore } = useTokenListContextData();

  const filteredTokens = useMemo(() => {
    const useNetworkSearch = !!isTokenSelector && !!searchAll;
    let resp = getFilteredTokenBySearchKey({
      tokens,
      searchKey: isTokenSelector ? tokenSelectorSearchKey : searchKey,
      searchAll,
      searchTokenList: isTokenSelector
        ? tokenSelectorSearchTokenList.tokens
        : searchTokenList.tokens,
      aggregateTokenListMap: allAggregateTokenMap,
      searchKeyLengthThreshold,
      networksMap: useNetworkSearch ? networksMap : undefined,
      enableNetworkSearch: useNetworkSearch,
      tokenFiatMap: useNetworkSearch
        ? { ...visibleTokenListMap, ...aggregateTokenMap }
        : undefined,
      localAggregateTokenListMap:
        useNetworkSearch && !showActiveAccountTokenList
          ? tokenSelectorAggregateTokenListMap
          : undefined,
    });

    if (!isTokenSelector) {
      if (sortType === ETokenListSortType.Price) {
        resp = sortTokensByPrice({
          tokens: resp,
          sortDirection,
          map: {
            ...visibleTokenListMap,
            ...aggregateTokenMap,
          },
        });
      } else if (sortType === ETokenListSortType.Value) {
        resp = sortTokensByFiatValue({
          tokens: resp,
          sortDirection,
          map: {
            ...visibleTokenListMap,
            ...aggregateTokenMap,
          },
        });
      } else if (sortType === ETokenListSortType.Name) {
        resp = sortTokensByName({
          tokens: resp,
          sortDirection,
        });
      }
    }

    return resp;
  }, [
    tokens,
    isTokenSelector,
    tokenSelectorSearchKey,
    searchKey,
    searchAll,
    tokenSelectorSearchTokenList.tokens,
    searchTokenList.tokens,
    allAggregateTokenMap,
    searchKeyLengthThreshold,
    networksMap,
    tokenSelectorAggregateTokenListMap,
    showActiveAccountTokenList,
    sortType,
    sortDirection,
    visibleTokenListMap,
    aggregateTokenMap,
  ]);

  const limitedTokens = useMemo(() => {
    if (overFlowState.isOverflow && overFlowState.isSliced) {
      return filteredTokens.slice(0, limit);
    }
    return filteredTokens;
  }, [filteredTokens, overFlowState.isOverflow, overFlowState.isSliced, limit]);

  // SLC render binding (spec §5, §11.3, PR-S): the container subscribes to
  // `listStructureAtom`. On the HOME path it derives the displayed order from a
  // PURE projection over `orderedIds ∪ smallBalanceIds` reading per-id cell/meta
  // values (NOT the whole map), keyed on `listStructure.generation` + sort /
  // search / hideZero. Because `generation` bumps ONLY on a structure frame, a
  // pure price tick does not recompute this memo and the container does not
  // re-render the list — only the changed leaf cell re-renders (spec §11.3).
  //
  // The per-id reads are NON-REACTIVE `store.get(...)` snapshots (NOT
  // `useAtomValue`) so a cell write alone never re-runs the projection (risk
  // #9). Non-home paths (TokenSelector / scoped / active-account) keep the
  // legacy `limitedTokens` → `tokenByKey` path, completely unchanged.
  const [listStructure] = useListStructureAtom();

  // HOME pure projection over the structure ids. The cell/meta reads are
  // captured at structure-frame time via `store.get`, so the deps are the
  // structure generation + sort/search/hideZero only — NOT the live fiat map.
  const homeProjectedIds = useMemo(() => {
    if (!isHomeProjectionPath || !tokenListStore) {
      return undefined;
    }
    // Cold-start / owner-switch guard (risk #10): if no structure frame has
    // landed for the current owner yet (generation < 0) or the producer has
    // not emitted any ids, fall back to the legacy path so cached tokens still
    // render instead of an empty flash.
    if (
      listStructure.generation < 0 ||
      (listStructure.orderedIds.length === 0 &&
        listStructure.smallBalanceIds.length === 0)
    ) {
      return undefined;
    }
    const s = tokenListStore;
    const getMeta = (key: string) => s.get(metaCell(s, key));
    const getFiat = (key: string) => {
      const metaValue = s.get(metaCell(s, key));
      return isAgg(key, metaValue)
        ? s.get(aggCell(s, key))
        : s.get(cell(s, key));
    };
    return projectHomeDisplayIds({
      orderedIds: listStructure.orderedIds,
      smallBalanceIds: listStructure.smallBalanceIds,
      nonZeroIds: listStructure.nonZeroIds,
      searchKey,
      searchKeyLengthThreshold,
      sortType,
      sortDirection,
      hideZero: !!hideZeroBalanceTokens,
      hideDeFiMarked: !!hideDeFiMarkedTokens,
      getFiat,
      getMeta,
      aggregateTokenListMap: allAggregateTokenMap,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isHomeProjectionPath,
    tokenListStore,
    listStructure.generation,
    searchKey,
    searchKeyLengthThreshold,
    sortType,
    sortDirection,
    hideZeroBalanceTokens,
    hideDeFiMarkedTokens,
    allAggregateTokenMap,
  ]);

  // The home projection drives the order; apply the same overflow slice the
  // legacy path applies (risk #7: slice the projected ids, not filteredTokens).
  const homeDisplayIdsLimited = useMemo(() => {
    if (!homeProjectedIds) {
      return undefined;
    }
    if (overFlowState.isOverflow && overFlowState.isSliced && limit) {
      return homeProjectedIds.slice(0, limit);
    }
    return homeProjectedIds;
  }, [
    homeProjectedIds,
    overFlowState.isOverflow,
    overFlowState.isSliced,
    limit,
  ]);

  // `displayIds`: home → projected (sliced) ids; non-home → legacy filtered
  // order `.map($key)`.
  const displayIds = useMemo(
    () => homeDisplayIdsLimited ?? limitedTokens.map((item) => item.$key),
    [homeDisplayIdsLimited, limitedTokens],
  );

  // Lookup so the list can render from `displayIds` while the row still gets the
  // full token object for its static meta. `$key` is the canonical unique id.
  // Non-home path: built from `limitedTokens`.
  const tokenByKey = useMemo(() => {
    const map = new Map<string, IAccountToken>();
    for (const item of limitedTokens) {
      map.set(item.$key, item);
    }
    return map;
  }, [limitedTokens]);

  // HOME row reconstruction (risk #8): rebuild the row object from the meta
  // cell + `$key` so rows are STABLE across price ticks (the meta cell carries
  // every static field TokenListItem reads + accountId/order for onPressToken,
  // since the producer stores the full IToken sans `$key`). Recomputed only
  // when the projected ids or the structure generation change.
  const listData = useMemo(() => {
    if (homeDisplayIdsLimited && tokenListStore) {
      void listStructure.generation;
      const s = tokenListStore;
      return homeDisplayIdsLimited
        .map((key) => {
          const m = s.get(metaCell(s, key));
          if (!m) {
            // Fall back to the legacy token object if the meta cell is not yet
            // populated for this id (defensive; should not happen post-frame).
            return tokenByKey.get(key);
          }
          return { $key: key, ...m } as IAccountToken;
        })
        .filter((t): t is IAccountToken => !!t);
    }
    return displayIds
      .map((key) => tokenByKey.get(key))
      .filter((t): t is IAccountToken => !!t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    homeDisplayIdsLimited,
    tokenListStore,
    displayIds,
    tokenByKey,
    listStructure.generation,
  ]);

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  // `.length` consumers branch (spec PR-S Step 4). A single derived count for
  // the post-filter "has tokens / footer" checks, and a PRE-slice count for the
  // overflow effect (risk #7). On home both come from the projection; non-home
  // keeps `filteredTokens.length`. The `filteredTokens.length===0` skeleton
  // guard is intentionally left on `filteredTokens` because it lives inside an
  // `isTokenSelector && searchAll` block that the home path never enters.
  const displayCount = isHomeProjectionPath
    ? displayIds.length
    : filteredTokens.length;
  const displayCountForOverflow =
    isHomeProjectionPath && homeProjectedIds
      ? homeProjectedIds.length
      : filteredTokens.length;

  const [, setIsInRequest] = useState(false);
  useEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      return;
    }
    const fn = ({ isRefreshing }: { isRefreshing: boolean }) => {
      setIsInRequest(isRefreshing);
    };
    appEventBus.on(EAppEventBusNames.TabListStateUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.TabListStateUpdate, fn);
    };
  }, []);

  const showSkeleton = useMemo(() => {
    if (
      showActiveAccountTokenList &&
      !activeAccountTokenListState.initialized &&
      activeAccountTokenListState.isRefreshing
    ) {
      return true;
    }

    if (
      isTokenSelector &&
      searchAll &&
      tokenSelectorSearchKey.length >=
        (searchKeyLengthThreshold ?? SEARCH_KEY_MIN_LENGTH) &&
      tokenSelectorSearchTokenList.searchKey !== tokenSelectorSearchKey &&
      filteredTokens.length === 0
    ) {
      return true;
    }

    // Per-owner cache hit → instant display, never skeleton. This covers
    // both cold-start (atom hydrating from disk) and in-session switches
    // back to a previously-rendered network/account. Require a paired
    // `tokenListMap` so we don't suppress the skeleton over a legacy entry
    // that would render tokens against the previous owner's map.
    const cached =
      ownerCacheKey &&
      renderedTokenListCacheRef.current.byOwner?.[ownerCacheKey];
    if (
      !showActiveAccountTokenList &&
      cached &&
      cached.tokens.length > 0 &&
      cached.tokenListMap
    ) {
      return false;
    }
    // Loaded atoms belong to a previous owner and we have no cache for the
    // current owner — show skeleton until `initTokenListData` refreshes the
    // atoms. Without this `tokenListState.initialized` is still true from
    // the prior network so the existing checks below would not fire.
    if (ownerMismatch && !showActiveAccountTokenList) {
      return true;
    }
    // PR-3: selector list is the self-fetched `tokenSelectorTokenList` (props),
    // not the home atoms. The home mirror keeps `tokenListState.initialized`
    // true, so the final clause below never fires for the selector and the
    // selector would render EmptyToken for a frame before the self-fetch lands.
    // Show a skeleton until the selector self-fetch resolves (the cache-hit
    // check above already returned `false` when a per-owner cached list exists,
    // matching the pre-PR-3 instant render).
    if (
      isTokenSelector &&
      !showActiveAccountTokenList &&
      !tokenSelectorInitialized
    ) {
      return true;
    }
    return (
      (isTokenSelector && tokenSelectorSearchTokenState.isSearching) ||
      (!isTokenSelector && searchTokenState.isSearching) ||
      (!tokenListState.initialized && tokenListState.isRefreshing)
    );
  }, [
    ownerMismatch,
    ownerCacheKey,
    isTokenSelector,
    tokenSelectorInitialized,
    searchAll,
    tokenSelectorSearchKey,
    tokenSelectorSearchTokenList.searchKey,
    searchKeyLengthThreshold,
    filteredTokens.length,
    tokenSelectorSearchTokenState.isSearching,
    searchTokenState.isSearching,
    tokenListState.initialized,
    tokenListState.isRefreshing,
    activeAccountTokenListState.initialized,
    activeAccountTokenListState.isRefreshing,
    showActiveAccountTokenList,
  ]);

  useEffect(() => {
    if (showSkeleton) {
      perfTokenListView.reset();
    } else {
      perfTokenListView.done();
    }
  }, [showSkeleton]);

  useEffect(() => {
    if (!tokenListState.initialized) {
      perfTokenListView.markStart('tokenListStateInitialize');
    } else {
      perfTokenListView.markEnd('tokenListStateInitialize');
    }
  }, [tokenListState.initialized]);

  useEffect(() => {
    if (tokenListState.isRefreshing) {
      perfTokenListView.markStart('tokenListStateRefreshing');
      perfTokenListView.markStart('tokenListRefreshing_tokenListPageUseEffect');
      perfTokenListView.markStart(
        'tokenListRefreshing_tokenListContainerRefreshList',
      );
      perfTokenListView.markStart('tokenListRefreshing_allNetworkRequests');
      perfTokenListView.markStart('tokenListRefreshing_allNetworkCacheData');
      perfTokenListView.markStart('tokenListRefreshing_initTokenListData');
      perfTokenListView.markStart('tokenListRefreshing_emptyAccount');
    } else {
      perfTokenListView.markEnd('tokenListStateRefreshing');
      perfTokenListView.markEnd('tokenListRefreshing_1');
      perfTokenListView.markEnd('tokenListRefreshing_2');
    }
  }, [tokenListState.isRefreshing]);

  const {
    ListHeaderComponentStyle,
    ListFooterComponentStyle,
    contentContainerStyle,
  } = listViewStyleProps || {};

  const resolvedContentContainerStyle = useStyle(contentContainerStyle || {}, {
    resolveValues: 'auto',
  });

  const resolvedListHeaderComponentStyle = useStyle(
    ListHeaderComponentStyle || {},
    {
      resolveValues: 'auto',
    },
  );

  const resolvedListFooterComponentStyle = useStyle(
    ListFooterComponentStyle || {},
    {
      resolveValues: 'auto',
    },
  );

  const ListComponent = useMemo(() => {
    return inTabList ? Tabs.FlatList : ListView;
  }, [inTabList]);

  const EmptyComponentElement = useMemo(() => {
    if (showSkeleton) {
      return (
        <YStack style={{ flex: 1 }}>
          <ListLoading isTokenSelectorView={!tableLayout} />
        </YStack>
      );
    }
    if (emptyAccountView) {
      return emptyAccountView as ReactElement;
    }
    return searchKey ? (
      <EmptySearch
        onManageToken={onManageToken}
        manageTokenEnabled={manageTokenEnabled}
        {...emptyProps}
      />
    ) : (
      <EmptyToken {...emptyProps} />
    );
  }, [
    emptyAccountView,
    manageTokenEnabled,
    onManageToken,
    searchKey,
    showSkeleton,
    tableLayout,
    emptyProps,
  ]);

  useEffect(() => {
    if (limit) {
      setOverFlowState((prev) => ({
        ...prev,
        isOverflow: displayCountForOverflow > limit,
      }));
    }
  }, [displayCountForOverflow, limit]);

  const renderPlainModeFooter = useCallback(() => {
    if (overFlowState.isOverflow && overFlowState.isSliced) {
      return (
        <XStack pt="$3" px="$5" jc="center" ai="center">
          <Button
            testID="token-list-show-more-btn"
            size="medium"
            variant="secondary"
            onPress={() =>
              setOverFlowState((prev) => ({ ...prev, isSliced: false }))
            }
            flex={1}
          >
            {intl.formatMessage({ id: ETranslations.global_show_more })}
          </Button>
        </XStack>
      );
    }
    return (
      <Stack pb="$5">
        {withFooter ? (
          <TokenListFooter
            tableLayout={tableLayout}
            hideZeroBalanceTokens={hideZeroBalanceTokens}
            hideDeFiMarkedTokens={hideDeFiMarkedTokens}
            hasTokens={displayCount > 0}
            manageTokenEnabled={manageTokenEnabled}
            plainMode={plainMode}
          />
        ) : null}
        {!tokenSelectorSearchKey && footerTipText ? (
          <Stack jc="center" ai="center" pt="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              {footerTipText}
            </SizableText>
          </Stack>
        ) : null}
        {overFlowState.isOverflow && !overFlowState.isSliced ? (
          <XStack jc="center" ai="center" pt="$3" px="$5">
            <Button
              testID="token-list-show-less-btn"
              size="medium"
              variant="secondary"
              onPress={() =>
                setOverFlowState((prev) => ({ ...prev, isSliced: true }))
              }
              flex={1}
            >
              {intl.formatMessage({ id: ETranslations.global_show_less })}
            </Button>
          </XStack>
        ) : null}
      </Stack>
    );
  }, [
    overFlowState.isOverflow,
    overFlowState.isSliced,
    withFooter,
    tableLayout,
    hideZeroBalanceTokens,
    displayCount,
    manageTokenEnabled,
    plainMode,
    tokenSelectorSearchKey,
    footerTipText,
    intl,
    hideDeFiMarkedTokens,
  ]);

  if (plainMode) {
    if (showSkeleton) {
      return <ListLoading isTokenSelectorView={!tableLayout} />;
    }

    if (!listData || listData.length === 0) {
      return searchKey ? (
        <EmptySearch
          onManageToken={onManageToken}
          manageTokenEnabled={manageTokenEnabled}
          {...emptyProps}
        />
      ) : (
        <EmptyToken {...emptyProps} />
      );
    }

    return (
      <YStack testID={testID}>
        {withHeader ? (
          <TokenListHeader
            onManageToken={onManageToken}
            manageTokenEnabled={manageTokenEnabled}
            {...(tokens.length > 0 && {
              tableLayout,
            })}
          />
        ) : null}
        {listData.map((item) => (
          <TokenListItem
            hideValue={hideValue}
            hideBalanceAndValue={hideBalanceAndValue}
            token={item}
            key={item.$key}
            onPress={onPressToken}
            tableLayout={tableLayout}
            withPrice={withPrice}
            isAllNetworks={isAllNetworks}
            withNetwork={withNetwork}
            isTokenSelector={isTokenSelector}
            withSwapAction={withSwapAction}
            showNetworkIcon={showNetworkIcon}
            withAggregateBadge={withAggregateBadge}
            showProcessingState={!!exchangeFilter}
            testIDPrefix={tokenItemTestIDPrefix}
            {...(tableLayout
              ? undefined
              : {
                  mx: '$2',
                  px: '$3',
                })}
          />
        ))}
        {renderPlainModeFooter()}
      </YStack>
    );
  }

  return (
    <ListComponent
      testID={testID}
      // @ts-ignore
      estimatedItemSize={tableLayout ? undefined : 60}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? <PullToRefresh onRefresh={onRefresh} /> : undefined
      }
      extraData={listData.length}
      data={listData}
      windowSize={platformEnv.isNativeAndroid && inTabList ? 3 : undefined}
      contentContainerStyle={resolvedContentContainerStyle as any}
      ListHeaderComponentStyle={resolvedListHeaderComponentStyle as any}
      ListFooterComponentStyle={resolvedListFooterComponentStyle as any}
      ListHeaderComponent={
        withHeader ? (
          <TokenListHeader
            onManageToken={onManageToken}
            manageTokenEnabled={manageTokenEnabled}
            {...(tokens.length > 0 && {
              tableLayout,
            })}
          />
        ) : null
      }
      ListEmptyComponent={EmptyComponentElement}
      renderItem={({ item, index }) => (
        <>
          <TokenListItem
            hideValue={hideValue}
            hideBalanceAndValue={hideBalanceAndValue}
            token={item}
            key={item.$key}
            onPress={onPressToken}
            tableLayout={tableLayout}
            withPrice={withPrice}
            isAllNetworks={isAllNetworks}
            withNetwork={withNetwork}
            isTokenSelector={isTokenSelector}
            withSwapAction={withSwapAction}
            showNetworkIcon={showNetworkIcon}
            withAggregateBadge={withAggregateBadge}
            showProcessingState={!!exchangeFilter}
            testIDPrefix={tokenItemTestIDPrefix}
          />
          {isTokenSelector &&
          tokenSelectorSearchTokenState.isSearching &&
          index === listData.length - 1 ? (
            <ListLoading isTokenSelectorView={!tableLayout} />
          ) : null}
        </>
      )}
      ListFooterComponent={
        <Stack pb="$5">
          {withFooter ? (
            <TokenListFooter
              tableLayout={tableLayout}
              hideZeroBalanceTokens={hideZeroBalanceTokens}
              hasTokens={displayCount > 0}
              manageTokenEnabled={manageTokenEnabled}
              plainMode={plainMode}
            />
          ) : null}
          {!tokenSelectorSearchKey && footerTipText ? (
            <Stack jc="center" ai="center" pt="$3">
              <SizableText size="$bodySm" color="$textSubdued">
                {footerTipText}
              </SizableText>
            </Stack>
          ) : null}
          {addPaddingOnListFooter ? <Stack h="$16" /> : null}
        </Stack>
      }
    />
  );
}

const TokenListView = memo((props: IProps) => {
  const [tokenListMap] = useTokenListMapAtom();
  // INTERIM (tokenList SLC full-delete plan, PR-1): mirror the still-living
  // `aggregateTokensListMapAtom` into the context so the per-key leaves
  // (TokenIconView / TokenNameView / TokenActionsView) resolve their owned
  // aggregate sub-token list from `ownedAggregateTokenListMap` instead of
  // importing the atom directly. PR-3/PR-7 swap the source to the SLC producer
  // payload and drop this atom read.
  const [aggregateTokensListMapValueFromAtom] = useAggregateTokensListMapAtom();
  // PR-3: the SELECTOR no longer depends on the home
  // `aggregateTokensListMapAtom` — it uses its self-fetched map threaded as a
  // prop. The home / non-selector path keeps the atom read (PR-7 removes it).
  // Memoized so the empty-default `{}` keeps a stable reference and does not
  // re-run the `contextValue` memo every render.
  const ownedAggregateTokenListMap = useMemo(() => {
    if (props.isTokenSelector) {
      return props.tokenSelectorAggregateTokenListMap ?? EMPTY_AGGREGATE_MAP;
    }
    return aggregateTokensListMapValueFromAtom;
  }, [
    props.isTokenSelector,
    props.tokenSelectorAggregateTokenListMap,
    aggregateTokensListMapValueFromAtom,
  ]);
  // An empty scoped map (`{}`, the default home state) is NOT an override; only
  // a POPULATED scoped LP map (LP-dapp mode) overrides the whole `tokenListMap`.
  // PR-3: on the selector path the leaves resolve per-row fiat from the
  // selector's self-fetched map (threaded as a prop) instead of the home
  // `tokenListMap` atom. The active-account scoped branch (used by both home
  // and selector) still wins. The home / non-selector path keeps the atom.
  const visibleTokenListMap = useMemo(() => {
    if (hasActiveScopedOverride(props.scopedActiveAccountTokenListMap)) {
      if (props.showActiveAccountTokenList) {
        return props.scopedActiveAccountTokenListMap ?? tokenListMap;
      }
    }
    if (props.showActiveAccountTokenList) {
      return tokenListMap;
    }
    if (props.isTokenSelector) {
      return props.tokenSelectorTokenListMap ?? EMPTY_FIAT_MAP;
    }
    return tokenListMap;
  }, [
    props.scopedActiveAccountTokenListMap,
    props.showActiveAccountTokenList,
    props.isTokenSelector,
    props.tokenSelectorTokenListMap,
    tokenListMap,
  ]);
  const needNetworksMap =
    !!props.isAllNetworks && (!!props.showNetworkIcon || !!props.withNetwork);
  const { result: allNetworksResp } = usePromiseResult<{
    networks: IServerNetwork[];
  }>(
    async () => {
      if (!needNetworksMap) {
        return { networks: [] };
      }
      return backgroundApiProxy.serviceNetwork.getAllNetworks();
    },
    [needNetworksMap],
    {
      initResult: { networks: [] },
    },
  );
  const networksMap = useMemo(() => {
    if (!needNetworksMap) {
      return undefined;
    }
    const networks = allNetworksResp?.networks ?? [];
    const map: Record<string, IServerNetwork> = {};
    for (const n of networks) {
      map[n.id] = n;
    }
    return map;
  }, [needNetworksMap, allNetworksResp]);

  // SLC cell seam (spec §5): only the home path may bind leaves to per-key
  // cells. Requires the producer (gated by `enableCellSeam`, set by
  // TokenListBlock) AND that this list renders the global map — not the
  // TokenSelector path and not an ACTIVE scoped/active-account override map
  // (those have no producer feeding their cells). The scoped LP map is held in
  // `useState({})`, so it is `{}` (NOT undefined) on the normal home mount — an
  // empty scoped map MUST count as "no override" or the seam is dead on home.
  const useCellSeam = resolveUseCellSeam({
    enableCellSeam: props.enableCellSeam,
    isTokenSelector: props.isTokenSelector,
    showActiveAccountTokenList: props.showActiveAccountTokenList,
    scopedActiveAccountTokenListMap: props.scopedActiveAccountTokenListMap,
  });

  const contextValue = useMemo(() => {
    return {
      allAggregateTokenMap: props.allAggregateTokenMap,
      ownedAggregateTokenListMap,
      networksMap,
      tokenListMap: visibleTokenListMap,
      useCellSeam,
    };
  }, [
    props.allAggregateTokenMap,
    ownedAggregateTokenListMap,
    networksMap,
    visibleTokenListMap,
    useCellSeam,
  ]);

  return (
    <TokenListViewContext.Provider value={contextValue}>
      <TokenListViewCmp {...props} />
    </TokenListViewContext.Provider>
  );
});

TokenListView.displayName = 'TokenListView';

export { TokenListView };
