import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { uniqBy } from 'lodash';

import {
  ListView,
  SizableText,
  Stack,
  Tabs,
  YStack,
  useStyle,
} from '@onekeyhq/components';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  buildHomeDefaultTokenMapKey,
  getFilteredTokenBySearchKey,
  sortTokensByFiatValue,
  sortTokensByName,
  sortTokensByPrice,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';
import type {
  IAccountToken,
  IHomeDefaultToken,
} from '@onekeyhq/shared/types/token';

import {
  useActiveAccountTokenListAtom,
  useActiveAccountTokenListStateAtom,
  useAggregateTokensMapAtom,
  useSearchKeyAtom,
  useSearchTokenListAtom,
  useSearchTokenStateAtom,
  useSmallBalanceTokenListAtom,
  useTokenListAtom,
  useTokenListMapAtom,
  useTokenListSortAtom,
  useTokenListStateAtom,
} from '../../states/jotai/contexts/tokenList';
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

type IProps = {
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
  allAggregateTokens?: IAccountToken[];
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  hideZeroBalanceTokens?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  keepDefaultZeroBalanceTokens?: boolean;
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
    tokenSelectorSearchKey = '',
    tokenSelectorSearchTokenState = { isSearching: false },
    tokenSelectorSearchTokenList = { tokens: [] },
    emptyAccountView,
    showActiveAccountTokenList = false,
    listViewStyleProps,
    onRefresh,
    showNetworkIcon,
    allAggregateTokens,
    allAggregateTokenMap,
    hideZeroBalanceTokens,
    homeDefaultTokenMap,
    keepDefaultZeroBalanceTokens = true,
  } = props;

  const [activeAccountTokenList] = useActiveAccountTokenListAtom();
  const [tokenList] = useTokenListAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const [aggregateTokenMap] = useAggregateTokensMapAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const [activeAccountTokenListState] = useActiveAccountTokenListStateAtom();

  const tokens = useMemo(() => {
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

    if (isAllNetworks && allAggregateTokenMap && allAggregateTokens) {
      resultTokens = uniqBy(
        [...resultTokens, ...allAggregateTokens],
        (item) => item.$key,
      );
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

        if (keepDefaultZeroBalanceTokens && homeDefaultTokenMap) {
          if (
            homeDefaultTokenMap[
              buildHomeDefaultTokenMapKey({
                networkId: item.networkId ?? '',
                symbol: item.commonSymbol ?? item.symbol ?? '',
              })
            ] &&
            (item.isNative || item.isAggregateToken)
          ) {
            return true;
          }
        }

        return false;
      });
    }

    return resultTokens;
  }, [
    showActiveAccountTokenList,
    isTokenSelector,
    searchKey,
    isAllNetworks,
    allAggregateTokenMap,
    allAggregateTokens,
    hideZeroBalanceTokens,
    homeDefaultTokenMap,
    keepDefaultZeroBalanceTokens,
    activeAccountTokenList.tokens,
    tokenList.tokens,
    smallBalanceTokenList.smallBalanceTokens,
    tokenListMap,
    aggregateTokenMap,
  ]);

  const [searchTokenState] = useSearchTokenStateAtom();

  const [searchTokenList] = useSearchTokenListAtom();

  const [{ sortType, sortDirection }] = useTokenListSortAtom();

  const filteredTokens = useMemo(() => {
    const resp = getFilteredTokenBySearchKey({
      tokens,
      searchKey: isTokenSelector ? tokenSelectorSearchKey : searchKey,
      searchAll,
      searchTokenList: isTokenSelector
        ? tokenSelectorSearchTokenList.tokens
        : searchTokenList.tokens,
      aggregateTokenListMap: allAggregateTokenMap,
    });

    if (!isTokenSelector) {
      if (sortType === ETokenListSortType.Price) {
        return sortTokensByPrice({
          tokens: resp,
          sortDirection,
          map: {
            ...tokenListMap,
            ...aggregateTokenMap,
          },
        });
      }

      if (sortType === ETokenListSortType.Value) {
        return sortTokensByFiatValue({
          tokens: resp,
          sortDirection,
          map: {
            ...tokenListMap,
            ...aggregateTokenMap,
          },
        });
      }

      if (sortType === ETokenListSortType.Name) {
        return sortTokensByName({
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
    sortType,
    sortDirection,
    tokenListMap,
    aggregateTokenMap,
  ]);

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

  const showSkeleton = useMemo(
    () =>
      (isTokenSelector && tokenSelectorSearchTokenState.isSearching) ||
      (!isTokenSelector && searchTokenState.isSearching) ||
      (!tokenListState.initialized && tokenListState.isRefreshing) ||
      (!activeAccountTokenListState.initialized &&
        showActiveAccountTokenList &&
        activeAccountTokenListState.isRefreshing),
    [
      isTokenSelector,
      tokenSelectorSearchTokenState.isSearching,
      searchTokenState.isSearching,
      tokenListState.initialized,
      tokenListState.isRefreshing,
      activeAccountTokenListState.initialized,
      activeAccountTokenListState.isRefreshing,
      showActiveAccountTokenList,
    ],
  );

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
      />
    ) : (
      <EmptyToken />
    );
  }, [
    emptyAccountView,
    manageTokenEnabled,
    onManageToken,
    searchKey,
    showSkeleton,
    tableLayout,
  ]);

  return (
    <ListComponent
      // @ts-ignore
      estimatedItemSize={tableLayout ? undefined : 60}
      refreshControl={
        onRefresh ? <PullToRefresh onRefresh={onRefresh} /> : undefined
      }
      extraData={filteredTokens.length}
      data={filteredTokens}
      contentContainerStyle={resolvedContentContainerStyle as any}
      ListHeaderComponentStyle={resolvedListHeaderComponentStyle as any}
      ListFooterComponentStyle={resolvedListFooterComponentStyle as any}
      ListHeaderComponent={
        withHeader ? (
          <TokenListHeader
            filteredTokens={filteredTokens}
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
          />
          {isTokenSelector &&
          tokenSelectorSearchTokenState.isSearching &&
          index === filteredTokens.length - 1 ? (
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
            />
          ) : null}
          {footerTipText ? (
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
  const contextValue = useMemo(() => {
    return {
      allAggregateTokenMap: props.allAggregateTokenMap,
    };
  }, [props.allAggregateTokenMap]);

  return (
    <TokenListViewContext.Provider value={contextValue}>
      <TokenListViewCmp {...props} />
    </TokenListViewContext.Provider>
  );
});

TokenListView.displayName = 'TokenListView';

export { TokenListView };
