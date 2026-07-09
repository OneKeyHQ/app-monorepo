import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

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
  useActiveAccountTokenListAtom,
  useActiveAccountTokenListStateAtom,
  useListStructureAtom,
  useSearchKeyAtom,
  useSearchTokenListAtom,
  useSearchTokenStateAtom,
  useTokenListContextData,
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
} from '../../states/jotai/contexts/tokenList/cells';
import { useTokenManagement } from '../../views/AssetList/hooks/useTokenManagement';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import { EmptySearch } from '../Empty';
import { EmptyToken } from '../Empty/EmptyToken';
import { ListLoading } from '../Loading';

import { computeShowTokenListSkeleton } from './computeShowTokenListSkeleton';
import { computeTokenListOwnerMismatch } from './computeTokenListOwnerMismatch';
import { perfTokenListView } from './perfTokenListView';
import { TokenListFooter } from './TokenListFooter';
import { TokenListHeader } from './TokenListHeader';
import { TokenListItem } from './TokenListItem';
import {
  TokenListViewContext,
  useTokenListViewContext,
} from './TokenListViewContext';

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
  // TokenSelector self-fetched data threaded as props (tokenList cells
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
  // PR-6: the selector's self-fetched, flattened aggregate fiat map
  // ($key -> summed ITokenFiat across networks). The per-row
  // `tokenSelectorTokenListMap` does NOT carry aggregate `$key` fiat, so the
  // selector path feeds THIS into `context.aggregateTokenFiatMap` (instead of
  // EMPTY) and the non-cell leaves resolve aggregate-row balance/value/price.
  tokenSelectorAggregateTokenFiatMap?: Record<string, ITokenFiat>;
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
  // Generalized "host-provided maps" seam (tokenList cells full-delete plan,
  // PR-7). Any NON-cell caller (AssetList modal, active-account, LP-scoped)
  // fills these from its OWN source instead of the home target atoms, so the
  // wrapper + inner cmp no longer read `tokenListAtom` / `tokenListMapAtom` /
  // `smallBalanceTokenListAtom` / `flattenAggregateTokensMapAtom` /
  // `aggregateTokensListMapAtom` to serve those paths. AssetList passes its
  // route-param `tokens` / `tokenMap` / `aggregateTokensListMap` / flattened-agg.
  // On the HOME cell path these are unused (cells + `listStructureAtom` serve).
  // The `tokenSelector*` props remain the selector-path source; these host props
  // cover the other non-cell callers.
  hostTokenList?: {
    tokens: IAccountToken[];
    smallBalanceTokens: IAccountToken[];
  };
  hostTokenListMap?: Record<string, ITokenFiat>;
  hostAggregateTokenFiatMap?: Record<string, ITokenFiat>;
  hostAggregateTokenListMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
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
  // TokenList cells render binding (spec §5). Opt-in flag set ONLY by the home
  // `TokenListBlock`, where `useTokenListCellsProducer` is mounted and feeds the
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
    hostTokenList,
    hostTokenListMap: hostTokenListMapProp,
    hostAggregateTokenFiatMap,
    scopedActiveAccountTokenList,
    scopedActiveAccountTokenListState,
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
  // SETTLED owner identity for the switch skeleton (red-team C-F1): the
  // producer stamps `listStructureAtom().ownerKey = `${accountId}__${networkId}``
  // on every applied STRUCTURE frame, so it LAGS the scoped current owner on a
  // network/account switch exactly like the deleted `allTokenListAtom` did —
  // which is what keeps `ownerMismatch` firing (do NOT collapse to the scoped
  // `accountId`/`networkId`, that would make it eternally false and flash the
  // previous owner's balances). Empty on non-home stores (no producer), so
  // `ownerMismatch` stays false there, matching the prior empty-atom behavior.
  const [listStructure] = useListStructureAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const [activeAccountTokenListStateAtomValue] =
    useActiveAccountTokenListStateAtom();
  // PR-7: the inner cmp no longer reads `tokenListAtom` / `tokenListMapAtom` /
  // `flattenAggregateTokensMapAtom` / `aggregateTokensMapAtom` /
  // `smallBalanceTokenListAtom`. On the HOME cell path the order/membership/rows
  // come from `homeProjectedIds` / `listData` (cells + `listStructureAtom`) and
  // the `tokens` memo early-returns `[]` (see below), so these values are unused.
  // On the NON-home paths they are sourced from generalized HOST props the caller
  // fills from its own non-target source (AssetList route params; selector
  // self-fetch). The active-account scoped branch keeps its scoped map.
  const tokenList = useMemo(
    () => hostTokenList ?? { tokens: [] as IAccountToken[] },
    [hostTokenList],
  );
  const smallBalanceTokenList = useMemo(
    () => ({
      smallBalanceTokens: hostTokenList?.smallBalanceTokens ?? [],
    }),
    [hostTokenList],
  );
  const hostTokenListMap = useMemo(
    () => hostTokenListMapProp ?? EMPTY_FIAT_MAP,
    [hostTokenListMapProp],
  );
  const aggregateTokenMap = useMemo(
    () => hostAggregateTokenFiatMap ?? EMPTY_FIAT_MAP,
    [hostAggregateTokenFiatMap],
  );
  const activeAccountTokenList =
    scopedActiveAccountTokenList ?? activeAccountTokenListAtomValue;
  const activeAccountTokenListState =
    scopedActiveAccountTokenListState ?? activeAccountTokenListStateAtomValue;
  // Selector fiat map (tokenList cells full-delete plan, PR-3): on the selector
  // path the displayed list + fiat map are self-fetched by TokenSelector and
  // threaded as props, so the selector no longer reads the home `tokenListMap`
  // atom. The active-account scoped branch (LP-dapp / cross-account view) keeps
  // its own scoped map and is unaffected.
  const selectorFiatMap = useMemo(
    () => tokenSelectorTokenListMap ?? EMPTY_FIAT_MAP,
    [tokenSelectorTokenListMap],
  );
  // An empty scoped map (`{}`, the default home state) is NOT an override — fall
  // back to the host map (or selector fiat) so the legacy / scoped path reads
  // real fiat. Only a POPULATED scoped LP map overrides (LP-dapp mode). PR-7: the
  // old `?? tokenListMap` ATOM fallback is replaced by the host/selector props;
  // on the home cell path this whole value is unused (cells serve the leaves).
  const activeAccountTokenListMap = hasActiveScopedOverride(
    scopedActiveAccountTokenListMap,
  )
    ? (scopedActiveAccountTokenListMap ?? hostTokenListMap)
    : hostTokenListMap;
  // Priority: active-account scoped map (LP-dapp / cross-account, used by both
  // home AND selector) wins; then the selector's self-fetched map; then the host
  // map (AssetList route params; empty on home where cells serve).
  let visibleTokenListMap = hostTokenListMap;
  if (showActiveAccountTokenList) {
    visibleTokenListMap = activeAccountTokenListMap;
  } else if (isTokenSelector) {
    visibleTokenListMap = selectorFiatMap;
  }

  const { networksMap, useCellSeam } = useTokenListViewContext();
  // HOME projection path marker — read the SAME context flag the leaves read so
  // home/leaf agree (spec §5, PR-S). The wrapper computes
  // `useCellSeam = enableCellSeam && !isTokenSelector &&
  // !showActiveAccountTokenList && !scopedActiveAccountTokenListMap`; the inner
  // cmp reads it here rather than recomputing divergently. Hoisted above the
  // `tokens`/`filteredTokens` memos so those legacy-atom memos can early-return
  // on the home projection path (PR-6: free the HOME data path of the legacy
  // atom values).
  const isHomeProjectionPath = !!useCellSeam;

  const tokenManagementEnabled =
    !deferTokenManagement || tokenListState.initialized;
  // On the HOME projection path the only consumer of `customTokens` is the
  // legacy `tokens` memo, which early-returns `[]` before reading it (line ~426),
  // so the fetch here is pure waste — the home hideZero authority is the cells
  // producer fed by `TokenListBlock`'s own `useTokenManagement`. Disable this
  // inner call on home to avoid duplicating that heavy fetch tree every
  // structure frame; the non-home hosts (selector / active-account / AssetList)
  // still consume `customTokens` and keep fetching.
  const { customTokens } = useTokenManagement({
    accountId,
    networkId,
    indexedAccountId,
    mergeDeriveAddressData,
    enabled: tokenManagementEnabled && !isHomeProjectionPath,
  });

  // The token list atoms are scoped to a singleton store, so they survive the
  // PortfolioContainer remount that fires on every account/network switch and
  // briefly carry the previous owner's data. The non-home skeleton/empty paths
  // (AssetList / active-account) rely on `tokenListState.initialized` from their
  // own `refresh*`, NOT on this flag; on home the cells + `listStructure`
  // generation govern (see `homeProjectedIds`). Kept for the non-home skeleton
  // gate below.
  // Compare the SETTLED structure ownerKey (lagging, stamped by the cells
  // producer) against the scoped current owner — but NORMALIZED the SAME way the
  // producer stamps it. The producer's key is
  // `${getTokenListOwnerCacheAccountId(...)}__${networkId}` (merge-derive owners
  // are keyed by `indexedAccountId`, not the raw derive `accountId`). Re-parsing
  // and comparing the raw scoped `accountId` here would diverge from that stamp
  // on merge-derive accounts (BTC/LTC) — the raw derive path never equals the
  // stamped `indexedAccountId`, so the mismatch would latch TRUE forever and the
  // home list would skeleton permanently (only ever hit on merge-derive owners;
  // EVM collapses to the same string). See `computeTokenListOwnerMismatch`.
  const ownerMismatch = useMemo(
    () =>
      computeTokenListOwnerMismatch({
        accountId,
        networkId,
        indexedAccountId,
        mergeDeriveAddressData,
        settledOwnerKey: listStructure.ownerKey,
      }),
    [
      accountId,
      networkId,
      indexedAccountId,
      mergeDeriveAddressData,
      listStructure.ownerKey,
    ],
  );

  const tokens = useMemo(() => {
    // PR-7: on the HOME cell path order/membership/rows come from
    // `homeProjectedIds` / `listData` (cells + `listStructureAtom`), so the
    // legacy `tokens` value is consumed by neither the list nor `filteredTokens`
    // (which early-returns on home). Return `[]` so the home data path executes
    // ZERO legacy whole-map reads — the inner cmp no longer subscribes to
    // `tokenListMap`/`flattenAgg`/`tokenList`, so a price tick re-renders only
    // the changed leaf cell (PR-S invariant holds at the container level).
    if (isHomeProjectionPath) {
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

    return resultTokens;
  }, [
    isHomeProjectionPath,
    showActiveAccountTokenList,
    isTokenSelector,
    searchKey,
    hideZeroBalanceTokens,
    hideDeFiMarkedTokens,
    activeAccountTokenList.tokens,
    tokenList.tokens,
    smallBalanceTokenList.smallBalanceTokens,
    tokenSelectorTokenList,
    visibleTokenListMap,
    aggregateTokenMap,
    keepDefaultZeroBalanceTokens,
    homeDefaultTokenMap,
    customTokens,
    exchangeFilter,
  ]);

  // PR-7: the legacy per-owner `renderedTokenListCache` PERSIST write was
  // REMOVED. The slim cold cache (`persistSlimColdCache`, written by the cells
  // producer off the cell projection) is now the single cold-paint authority,
  // and the BG per-owner VM covers switch-hydrate; the old whole-map write here
  // duplicated that and reintroduced a `tokenListMap`/`rawAggregateTokensMap`
  // whole-map dependency every structure frame. Dropping it frees the last
  // `renderedTokenListCacheAtom` reader in this file (D4 single-cold-authority).

  const [searchTokenState] = useSearchTokenStateAtom();

  const [searchTokenList] = useSearchTokenListAtom();

  const [{ sortType, sortDirection }] = useTokenListSortAtom();

  // The per-store cell registry handle — used for NON-REACTIVE per-id cell/meta
  // reads inside the displayIds projection (store.get, NOT useAtomValue) so a
  // price tick that only writes a cell does not re-run the projection memo
  // (spec §11.4 risk #9). `store` is always defined when a list store is
  // mounted (home always has one).
  const { store: tokenListStore } = useTokenListContextData();

  // P2a: hoist the network-search whole-map spread out of `filteredTokens` so a
  // search keystroke (which re-runs that memo) does not rebuild this O(N) object
  // on every keystroke; it is rebuilt only when the underlying maps change. Only
  // the selector network-search (`searchAll`) branch needs it. The sort-branch
  // spreads stay inline — different, mutually-exclusive `!isTokenSelector` gate.
  const useNetworkSearch = !!isTokenSelector && !!searchAll;
  const networkSearchTokenFiatMap = useMemo(
    () =>
      useNetworkSearch
        ? { ...visibleTokenListMap, ...aggregateTokenMap }
        : undefined,
    [useNetworkSearch, visibleTokenListMap, aggregateTokenMap],
  );

  const filteredTokens = useMemo(() => {
    // PR-6: the HOME path derives its order/membership from `homeProjectedIds`
    // (off `listStructure` + cells via `projectHomeDisplayIds`), so this memo —
    // and its `visibleTokenListMap`/`aggregateTokenMap` whole-map reads for
    // search/sort — must NOT run on home. `tokens` here is the raw UNSORTED home
    // list (= `tokenList.tokens`, non-empty on home); it is intentionally
    // bypassed because home order/membership come from `homeProjectedIds`. The
    // early-return keeps this memo off the legacy fiat maps so a price tick
    // cannot re-run a whole-map spread here (PR-S invariant).
    if (isHomeProjectionPath) {
      return tokens;
    }
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
      tokenFiatMap: networkSearchTokenFiatMap,
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
    isHomeProjectionPath,
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
    useNetworkSearch,
    networkSearchTokenFiatMap,
  ]);

  const limitedTokens = useMemo(() => {
    if (overFlowState.isOverflow && overFlowState.isSliced) {
      return filteredTokens.slice(0, limit);
    }
    return filteredTokens;
  }, [filteredTokens, overFlowState.isOverflow, overFlowState.isSliced, limit]);

  // cells render binding (spec §5, §11.3, PR-S): the container subscribes to
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
  // (`listStructure` is read once near the top of the component for the switch
  // skeleton owner; reused here.)

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
    const projected = projectHomeDisplayIds({
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
    return projected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isHomeProjectionPath,
    tokenListStore,
    // `ownerKey` is REQUIRED alongside `generation`: the BG resets the structure
    // generation to 0 for every owner (each owner VM starts at -1), so an
    // account switch keeps `generation` at 0→0 and this memo would otherwise
    // return the PREVIOUS owner's projected ids. The rows then render the old
    // account's `$key`s while the cells were rebuilt for the new owner's keys —
    // address-embedded keys (SOL/BNB/TRX/JupSOL) miss their new cell and show
    // "-" (BTC's address-free `btc--0_native` key coincidentally still matched).
    // Only bit native (singleton store survives the switch); web/desktop
    // recreate the store, masking it.
    listStructure.ownerKey,
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
    // see homeProjectedIds — owner switch keeps generation at 0, so key on
    // ownerKey too or listData maps stale (previous-owner) ids to meta cells.
    listStructure.ownerKey,
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

  // Skeleton decision extracted to a pure, unit-tested predicate
  // (computeShowTokenListSkeleton). The cold-start fix lives in its final
  // clause: the home first-load skeleton (`!initialized && isRefreshing`) now
  // also requires `displayCount === 0`, so the cells cold paint's rows render
  // immediately instead of being hidden by the plainMode `if (showSkeleton)`
  // early-return until the network round lands. PR-7/PR-3 branch rationale is
  // documented inline in that function.
  const showSkeleton = useMemo(() => {
    const decision = computeShowTokenListSkeleton({
      showActiveAccountTokenList: !!showActiveAccountTokenList,
      activeAccountTokenListInitialized:
        activeAccountTokenListState.initialized,
      activeAccountTokenListIsRefreshing:
        activeAccountTokenListState.isRefreshing,
      isTokenSelector: !!isTokenSelector,
      searchAll: !!searchAll,
      tokenSelectorSearchKeyLength: tokenSelectorSearchKey.length,
      searchKeyLengthThreshold:
        searchKeyLengthThreshold ?? SEARCH_KEY_MIN_LENGTH,
      tokenSelectorSearchTokenListSearchKey:
        tokenSelectorSearchTokenList.searchKey ?? '',
      tokenSelectorSearchKey,
      filteredTokensLength: filteredTokens.length,
      ownerMismatch,
      tokenSelectorInitialized: !!tokenSelectorInitialized,
      tokenSelectorSearchTokenStateIsSearching:
        tokenSelectorSearchTokenState.isSearching,
      searchTokenStateIsSearching: searchTokenState.isSearching,
      tokenListInitialized: tokenListState.initialized,
      tokenListIsRefreshing: tokenListState.isRefreshing,
      displayCount,
    });
    return decision;
  }, [
    ownerMismatch,
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
    displayCount,
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
  // PR-7: cell seam (spec §5). Hoisted ABOVE the context-fill memos so they
  // can branch on the home path. Only the home path may bind leaves to per-key
  // cells — requires the producer (gated by `enableCellSeam`, set by
  // TokenListBlock) AND that this list renders the global map (not selector / not
  // an ACTIVE scoped override). The scoped LP map is `{}` on the normal home
  // mount, so an empty scoped map MUST count as "no override" or the seam dies.
  const useCellSeam = resolveUseCellSeam({
    enableCellSeam: props.enableCellSeam,
    isTokenSelector: props.isTokenSelector,
    showActiveAccountTokenList: props.showActiveAccountTokenList,
    scopedActiveAccountTokenListMap: props.scopedActiveAccountTokenListMap,
  });

  // PR-7: the wrapper no longer reads `tokenListMapAtom` /
  // `flattenAggregateTokensMapAtom` / `aggregateTokensListMapAtom`. The home
  // `ownedAggregateTokenListMap` is sourced from the PRODUCER PAYLOAD via
  // `listStructureAtom` (structure-tier — bumps only on structure frames, NOT on
  // price ticks, so the PR-S price-tick-leaf-only invariant holds). The other two
  // context maps are UNUSED on home (leaves take cells) and sourced from
  // generalized HOST props / selector props on the non-cell paths.
  const [listStructure] = useListStructureAtom();

  // Per-`$key` owned aggregate sub-token METADATA list the cell-path + non-cell
  // leaves read from context. Home → producer payload (`listStructureAtom`);
  // selector → its self-fetched prop; other non-home (AssetList) → host prop.
  const ownedAggregateTokenListMap = useMemo(() => {
    if (props.isTokenSelector) {
      return props.tokenSelectorAggregateTokenListMap ?? EMPTY_AGGREGATE_MAP;
    }
    if (useCellSeam) {
      return listStructure.ownedAggregateTokenListMap;
    }
    return props.hostAggregateTokenListMap ?? EMPTY_AGGREGATE_MAP;
  }, [
    props.isTokenSelector,
    props.tokenSelectorAggregateTokenListMap,
    props.hostAggregateTokenListMap,
    useCellSeam,
    listStructure.ownedAggregateTokenListMap,
  ]);

  // Whole `$key -> ITokenFiat` map the NON-cell leaves resolve per-row fiat from.
  // Home → undefined (cells serve; never read). Active-account scoped override
  // (LP-dapp) wins; selector → its self-fetched per-row map; other non-home
  // (AssetList) → host map.
  const visibleTokenListMap = useMemo(() => {
    if (useCellSeam) {
      return undefined;
    }
    if (
      hasActiveScopedOverride(props.scopedActiveAccountTokenListMap) &&
      props.showActiveAccountTokenList
    ) {
      return props.scopedActiveAccountTokenListMap;
    }
    if (props.showActiveAccountTokenList) {
      return props.hostTokenListMap ?? EMPTY_FIAT_MAP;
    }
    if (props.isTokenSelector) {
      return props.tokenSelectorTokenListMap ?? EMPTY_FIAT_MAP;
    }
    return props.hostTokenListMap ?? EMPTY_FIAT_MAP;
  }, [
    useCellSeam,
    props.scopedActiveAccountTokenListMap,
    props.showActiveAccountTokenList,
    props.isTokenSelector,
    props.tokenSelectorTokenListMap,
    props.hostTokenListMap,
  ]);
  // Aggregate fiat the NON-cell leaves resolve from context.
  //  - home cell path: undefined (leaves take `aggCell` via `useTokenFiat`).
  //  - selector: the selector's OWN flattened aggregate fiat map (the per-row
  //    `tokenSelectorTokenListMap` does NOT carry aggregate `$key` fiat).
  //  - other non-home (AssetList): the host-provided flattened aggregate map.
  const aggregateTokenFiatMap = useMemo(() => {
    if (useCellSeam) {
      return undefined;
    }
    if (props.isTokenSelector) {
      return props.tokenSelectorAggregateTokenFiatMap ?? EMPTY_FIAT_MAP;
    }
    return props.hostAggregateTokenFiatMap ?? EMPTY_FIAT_MAP;
  }, [
    useCellSeam,
    props.isTokenSelector,
    props.tokenSelectorAggregateTokenFiatMap,
    props.hostAggregateTokenFiatMap,
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

  const contextValue = useMemo(() => {
    return {
      allAggregateTokenMap: props.allAggregateTokenMap,
      ownedAggregateTokenListMap,
      networksMap,
      tokenListMap: visibleTokenListMap,
      aggregateTokenFiatMap,
      useCellSeam,
    };
  }, [
    props.allAggregateTokenMap,
    ownedAggregateTokenListMap,
    networksMap,
    visibleTokenListMap,
    aggregateTokenFiatMap,
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
