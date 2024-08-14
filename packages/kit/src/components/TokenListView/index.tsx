import {
  ListView,
  SizableText,
  Stack,
  renderNestedScrollView,
} from '@onekeyhq/components';
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
  useTokenSelectorSearchKeyAtom,
  useTokenSelectorSearchTokenListAtom,
  useTokenSelectorSearchTokenStateAtom,
} from '../../states/jotai/contexts/tokenList';
import { EmptySearch } from '../Empty';
import { EmptyToken } from '../Empty/EmptyToken';
import { ListLoading } from '../Loading';

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
  isTokenSelector?: boolean;
  footerTipText?: string;
};

function TokenListView(props: IProps) {
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
  } = props;

  const [tokenList] = useTokenListAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const [tokenSelectorSearchKey] = useTokenSelectorSearchKeyAtom();

  const tokens = isTokenSelector
    ? tokenList.tokens.concat(smallBalanceTokenList.smallBalanceTokens)
    : tokenList.tokens;
  const [searchTokenState] = useSearchTokenStateAtom();

  const [tokenSelectorSearchTokenState] =
    useTokenSelectorSearchTokenStateAtom();

  const [searchTokenList] = useSearchTokenListAtom();

  const [tokenSelectorSearchTokenList] = useTokenSelectorSearchTokenListAtom();

  const filteredTokens = getFilteredTokenBySearchKey({
    tokens,
    searchKey: isTokenSelector ? tokenSelectorSearchKey : searchKey,
    searchAll,
    searchTokenList: isTokenSelector
      ? tokenSelectorSearchTokenList.tokens
      : searchTokenList.tokens,
  });

  const { listViewProps, listViewRef, onLayout } =
    useTabListScroll<IAccountToken>({
      inTabList,
    });

  if (
    (isTokenSelector && tokenSelectorSearchTokenState.isSearching) ||
    (!isTokenSelector && searchTokenState.isSearching) ||
    (!tokenListState.initialized && tokenListState.isRefreshing)
  ) {
    return <ListLoading isTokenSelectorView={!tableLayout} />;
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
        </Stack>
      }
    />
  );
}

export { TokenListView };
