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
  useMedia,
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

type IProps = {
  accountId: string;
  networkId: string;
  indexedAccountId: string | undefined;
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
    searchKeyLengthThreshold,
    plainMode,
    limit,
  } = props;

  const intl = useIntl();
  const media = useMedia();

  const [overFlowState, setOverFlowState] = useState<{
    isOverflow: boolean;
    isSliced: boolean;
  }>({
    isOverflow: false,
    isSliced: true,
  });

  const [activeAccountTokenList] = useActiveAccountTokenListAtom();
  const [tokenList] = useTokenListAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const [aggregateTokenMap] = useAggregateTokensMapAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const [activeAccountTokenListState] = useActiveAccountTokenListStateAtom();

  const { customTokens } = useTokenManagement({
    accountId,
    networkId,
    indexedAccountId,
  });

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

    return resultTokens;
  }, [
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
        <XStack py="$3" jc="center" ai="center">
          <Button
            size="small"
            variant="secondary"
            onPress={() =>
              setOverFlowState((prev) => ({ ...prev, isSliced: false }))
            }
            $md={
              {
                flexGrow: 1,
                flexBasis: 0,
                size: 'medium',
                borderRadius: '$full',
              } as any
            }
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
          <XStack jc="center" ai="center" pt="$3">
            <Button
              size="small"
              variant="secondary"
              onPress={() =>
                setOverFlowState((prev) => ({ ...prev, isSliced: true }))
              }
              $md={
                {
                  flexGrow: 1,
                  flexBasis: 0,
                  size: 'medium',
                  borderRadius: '$full',
                } as any
              }
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
      return (
        <ListLoading
          itemProps={
            tableLayout
              ? undefined
              : {
                  mx: '$0',
                  px: '$0',
                }
          }
          isTokenSelectorView={!tableLayout}
        />
      );
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
      <YStack>
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
            {...(tableLayout
              ? undefined
              : {
                  mx: '$0',
                  px: '$0',
                })}
          />
        ))}
        {renderPlainModeFooter()}
      </YStack>
    );
  }

  return (
    <ListComponent
      // @ts-ignore
      estimatedItemSize={tableLayout ? undefined : 60}
      refreshControl={
        onRefresh ? <PullToRefresh onRefresh={onRefresh} /> : undefined
      }
      extraData={limitedTokens.length}
      data={limitedTokens}
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
