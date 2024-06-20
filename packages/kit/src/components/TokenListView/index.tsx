import { ListView, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getFilteredTokenBySearchKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

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
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  withHeader?: boolean;
  withFooter?: boolean;
  withPrice?: boolean;
  withBuyAndReceive?: boolean;
  withPresetVerticalPadding?: boolean;
  onReceiveToken?: () => void;
  onBuyToken?: () => void;
  isBuyTokenSupported?: boolean;
};

function TokenListView(props: IProps) {
  const {
    onContentSizeChange,
    onPressToken,
    tableLayout,
    withHeader,
    withFooter,
    withPrice,
    withBuyAndReceive,
    onReceiveToken,
    onBuyToken,
    isBuyTokenSupported,
    withPresetVerticalPadding = true,
  } = props;

  const [tokenList] = useTokenListAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const { tokens } = tokenList;

  const filteredTokens = getFilteredTokenBySearchKey({ tokens, searchKey });

  if (!tokenListState.initialized && tokenListState.isRefreshing) {
    return <ListLoading onContentSizeChange={onContentSizeChange} />;
  }

  return (
    <ListView
      py={withPresetVerticalPadding ? '$3' : '$0'}
      estimatedItemSize={tableLayout ? 48 : 60}
      scrollEnabled={onContentSizeChange ? platformEnv.isWebTouchable : true}
      disableScrollViewPanResponder={!!onContentSizeChange}
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
      onContentSizeChange={onContentSizeChange}
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
      renderItem={({ item, index }) => (
        <TokenListItem
          token={item}
          key={item.$key}
          index={index}
          onPress={onPressToken}
          tableLayout={tableLayout}
          withPrice={withPrice}
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
