import { memo, useEffect, useMemo, useState } from 'react';

import {
  ListView,
  NestedScrollView,
  SizableText,
  Stack,
  renderNestedScrollView,
} from '@onekeyhq/components';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getFilteredTokenBySearchKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTabListScroll } from '../../hooks/useTabListScroll';
import {
  useSearchKeyAtom,
  useSearchTokenListAtom,
  useSearchTokenStateAtom,
  useSmallBalanceTokenListAtom,
  useTokenListAtom,
  useTokenListStateAtom,
} from '../../states/jotai/contexts/tokenList';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { EmptySearch } from '../Empty';
import { EmptyToken } from '../Empty/EmptyToken';
import { ListLoading } from '../Loading';

import { perfTokenListView } from './perfTokenListView';
import { TokenListFooter } from './TokenListFooter';
import { TokenListHeader } from './TokenListHeader';
import { TokenListItem } from './TokenListItem';

type IProps = {
  tableLayout?: boolean;
  onRefresh?: () => void;
  onPressToken?: (token: IAccountToken) => void;
  withHeader?: boolean;
  withFooter?: boolean;
  withPrice?: boolean;
  withBuyAndReceive?: boolean;
  withPresetVerticalPadding?: boolean;
  withNetwork?: boolean;
  withSmallBalanceTokens?: boolean;
  inTabList?: boolean;
  onReceiveToken?: () => void;
  onBuyToken?: () => void;
  isBuyTokenSupported?: boolean;
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
};

function TokenListViewCmp(props: IProps) {
  const {
    onPressToken,
    tableLayout,
    withHeader,
    withFooter,
    withPrice,
    inTabList = false,
    withBuyAndReceive,
    withNetwork,
    onReceiveToken,
    onBuyToken,
    isBuyTokenSupported,
    onManageToken,
    manageTokenEnabled,
    withPresetVerticalPadding = true,
    isAllNetworks,
    searchAll,
    isTokenSelector,
    footerTipText,
    hideValue,
    tokenSelectorSearchKey = '',
    tokenSelectorSearchTokenState = { isSearching: false },
    tokenSelectorSearchTokenList = { tokens: [] },
  } = props;

  const [tokenList] = useTokenListAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();

  const tokens = useMemo(() => {
    if (isTokenSelector) {
      return tokenList.tokens.concat(smallBalanceTokenList.smallBalanceTokens);
    }

    if (searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH) {
      return tokenList.tokens.concat(smallBalanceTokenList.smallBalanceTokens);
    }

    return tokenList.tokens;
  }, [
    isTokenSelector,
    searchKey,
    tokenList.tokens,
    smallBalanceTokenList.smallBalanceTokens,
  ]);
  const [searchTokenState] = useSearchTokenStateAtom();

  const [searchTokenList] = useSearchTokenListAtom();

  const filteredTokens = useMemo(
    () =>
      getFilteredTokenBySearchKey({
        tokens,
        searchKey: isTokenSelector ? tokenSelectorSearchKey : searchKey,
        searchAll,
        searchTokenList: isTokenSelector
          ? tokenSelectorSearchTokenList.tokens
          : searchTokenList.tokens,
      }),
    [
      tokens,
      isTokenSelector,
      tokenSelectorSearchKey,
      searchKey,
      searchAll,
      tokenSelectorSearchTokenList.tokens,
      searchTokenList.tokens,
    ],
  );

  const { listViewProps, listViewRef, onLayout } =
    useTabListScroll<IAccountToken>({
      inTabList,
    });

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  const [isInRequest, setIsInRequest] = useState(false);
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
      (!tokenListState.initialized && tokenListState.isRefreshing),
    [
      isTokenSelector,
      searchTokenState.isSearching,
      tokenListState.initialized,
      tokenListState.isRefreshing,
      tokenSelectorSearchTokenState.isSearching,
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

  if (showSkeleton) {
    return (
      <NestedScrollView style={{ flex: 1 }}>
        <ListLoading isTokenSelectorView={!tableLayout} />
      </NestedScrollView>
    );
  }

  return (
    <ListView
      {...listViewProps}
      renderScrollComponent={renderNestedScrollView}
      // py={withPresetVerticalPadding ? '$3' : '$0'}
      estimatedItemSize={tableLayout ? 48 : 60}
      ref={listViewRef}
      onLayout={onLayout}
      data={filteredTokens}
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
      ListEmptyComponent={
        searchKey ? (
          <EmptySearch
            onManageToken={onManageToken}
            manageTokenEnabled={manageTokenEnabled}
          />
        ) : (
          <EmptyToken
            withBuyAndReceive={withBuyAndReceive}
            isBuyTokenSupported={isBuyTokenSupported}
            onBuy={onBuyToken}
            onReceive={onReceiveToken}
          />
        )
      }
      renderItem={({ item }) => (
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
        />
      )}
      ListFooterComponent={
        <Stack pb="$5">
          {withFooter ? <TokenListFooter tableLayout={tableLayout} /> : null}
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

const TokenListView = memo(TokenListViewCmp);

export { TokenListView };
