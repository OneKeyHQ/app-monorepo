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
  useAggregateTokensMapAtom,
  useAllTokenListAtom,
  useFlattenAggregateTokensMapAtom,
  useRenderedTokenListCacheAtom,
  useSearchKeyAtom,
  useSearchTokenListAtom,
  useSearchTokenStateAtom,
  useSmallBalanceTokenListAtom,
  useTokenListAtom,
  useTokenListMapAtom,
  useTokenListSortAtom,
  useTokenListStateAtom,
} from '../../states/jotai/contexts/tokenList';
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
import { TokenListViewContext } from './TokenListViewContext';
import { getTokenListOwnerCacheAccountId } from './utils';

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
  };
  emptyAccountView?: ReactNode;
  showActiveAccountTokenList?: boolean;
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
    tokenSelectorSearchTokenList = { tokens: [] },
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
  } = props;

  const intl = useIntl();

  const [overFlowState, setOverFlowState] = useState<{
    isOverflow: boolean;
    isSliced: boolean;
  }>({
    isOverflow: false,
    isSliced: true,
  });

  const [activeAccountTokenList] = useActiveAccountTokenListAtom();
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
  const [activeAccountTokenListState] = useActiveAccountTokenListStateAtom();

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
    if (ownerMismatch) {
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
      resultTokens = tokenList.tokens.concat(
        smallBalanceTokenList.smallBalanceTokens,
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
          tokenListMap[item.$key]?.balance ??
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
      resultTokens = resultTokens.filter((item) => !item.defiMarked);
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
    if (resultTokens.length === 0 && !tokenListState.initialized) {
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
    tokenListMap,
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

  const filteredTokens = useMemo(() => {
    let resp = getFilteredTokenBySearchKey({
      tokens,
      searchKey: isTokenSelector ? tokenSelectorSearchKey : searchKey,
      searchAll,
      searchTokenList: isTokenSelector
        ? tokenSelectorSearchTokenList.tokens
        : searchTokenList.tokens,
      aggregateTokenListMap: allAggregateTokenMap,
      searchKeyLengthThreshold,
    });

    if (!isTokenSelector) {
      if (sortType === ETokenListSortType.Price) {
        resp = sortTokensByPrice({
          tokens: resp,
          sortDirection,
          map: {
            ...tokenListMap,
            ...aggregateTokenMap,
          },
        });
      } else if (sortType === ETokenListSortType.Value) {
        resp = sortTokensByFiatValue({
          tokens: resp,
          sortDirection,
          map: {
            ...tokenListMap,
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
    sortType,
    sortDirection,
    tokenListMap,
    aggregateTokenMap,
  ]);

  const limitedTokens = useMemo(() => {
    if (overFlowState.isOverflow && overFlowState.isSliced) {
      return filteredTokens.slice(0, limit);
    }
    return filteredTokens;
  }, [filteredTokens, overFlowState.isOverflow, overFlowState.isSliced, limit]);

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

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
    // Per-owner cache hit → instant display, never skeleton. This covers
    // both cold-start (atom hydrating from disk) and in-session switches
    // back to a previously-rendered network/account. Require a paired
    // `tokenListMap` so we don't suppress the skeleton over a legacy entry
    // that would render tokens against the previous owner's map.
    const cached =
      ownerCacheKey &&
      renderedTokenListCacheRef.current.byOwner?.[ownerCacheKey];
    if (cached && cached.tokens.length > 0 && cached.tokenListMap) {
      return false;
    }
    // Loaded atoms belong to a previous owner and we have no cache for the
    // current owner — show skeleton until `initTokenListData` refreshes the
    // atoms. Without this `tokenListState.initialized` is still true from
    // the prior network so the existing checks below would not fire.
    if (ownerMismatch) {
      return true;
    }
    return (
      (isTokenSelector && tokenSelectorSearchTokenState.isSearching) ||
      (!isTokenSelector && searchTokenState.isSearching) ||
      (!tokenListState.initialized && tokenListState.isRefreshing) ||
      (!activeAccountTokenListState.initialized &&
        showActiveAccountTokenList &&
        activeAccountTokenListState.isRefreshing)
    );
  }, [
    ownerMismatch,
    ownerCacheKey,
    isTokenSelector,
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
        isOverflow: filteredTokens.length > limit,
      }));
    }
  }, [filteredTokens.length, limit]);

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
            hasTokens={filteredTokens.length > 0}
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
    filteredTokens.length,
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

    if (!limitedTokens || limitedTokens.length === 0) {
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
        {limitedTokens.map((item) => (
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
      extraData={limitedTokens.length}
      data={limitedTokens}
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
          index === limitedTokens.length - 1 ? (
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
              hasTokens={filteredTokens.length > 0}
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
      networksMap,
    };
  }, [props.allAggregateTokenMap, networksMap]);

  return (
    <TokenListViewContext.Provider value={contextValue}>
      <TokenListViewCmp {...props} />
    </TokenListViewContext.Provider>
  );
});

TokenListView.displayName = 'TokenListView';

export { TokenListView };
