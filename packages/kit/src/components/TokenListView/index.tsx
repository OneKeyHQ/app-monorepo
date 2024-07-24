import { ListView, Stack, renderNestedScrollView } from '@onekeyhq/components';
import { getFilteredTokenBySearchKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTabListScroll } from '../../hooks/useTabListScroll';
import {
  useSearchKeyAtom,
  useTokenListAtom,
  useTokenListStateAtom,
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
  inTabList?: boolean;
  onReceiveToken?: () => void;
  onBuyToken?: () => void;
  isBuyTokenSupported?: boolean;
  isAllNetworks?: boolean;
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
    withPresetVerticalPadding = true,
    isAllNetworks,
  } = props;

  const [tokenList] = useTokenListAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const { tokens } = tokenList;

  const filteredTokens = getFilteredTokenBySearchKey({ tokens, searchKey });

  const { listViewProps, listViewRef, onLayout } =
    useTabListScroll<IAccountToken>({
      inTabList,
    });

  if (!tokenListState.initialized && tokenListState.isRefreshing) {
    return <ListLoading />;
  }

  return (
    <ListView
      {...listViewProps}
      renderScrollComponent={renderNestedScrollView}
      py={withPresetVerticalPadding ? '$3' : '$0'}
      estimatedItemSize={tableLayout ? 48 : 60}
      ref={listViewRef}
      onLayout={onLayout}
      data={filteredTokens}
      ListHeaderComponent={
        withHeader && tokens.length > 0 ? (
          <TokenListHeader
            filteredTokens={filteredTokens}
            tokens={tokens}
            tableLayout={tableLayout}
          />
        ) : null
      }
      ListEmptyComponent={
        searchKey ? (
          EmptySearch
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
        />
      )}
      ListFooterComponent={
        <Stack pb="$5">
          {withFooter ? <TokenListFooter tableLayout={tableLayout} /> : null}
        </Stack>
      }
    />
  );
}

export { TokenListView };
