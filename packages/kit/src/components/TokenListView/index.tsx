import { useEffect, useRef } from 'react';

import type { IListViewRef } from '@onekeyhq/components';
import { ListView, Stack, useScrollViewRef } from '@onekeyhq/components';
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

  const scrollViewRef = useScrollViewRef();
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);

  useEffect(() => {
    if (!platformEnv.isNative) {
      const onScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollViewRef.current;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight;
        if (isNearBottom) {
          listViewRef.current._listRef.getScrollRef().style.overflowY =
            'scroll';
        }
      };

      let lastScrollTop = 0;
      const onListViewScroll = () => {
        const { scrollTop } = listViewRef.current?._listRef._scrollRef;
        if (lastScrollTop > scrollTop && scrollTop === 0) {
          listViewRef.current._listRef.getScrollRef().style.overflowY =
            'hidden';
        }
        console.log(lastScrollTop, scrollTop);
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      };
      const scrollView = scrollViewRef?.current as unknown as HTMLElement;
      if (scrollView) {
        scrollView?.addEventListener('scroll', onScroll);
      }
      console.log(listViewRef);
      setTimeout(() => {
        console.log(listViewRef.current?._listRef._scrollRef);
        const listView = listViewRef.current?._listRef
          ._scrollRef as unknown as HTMLElement;
        if (listView) {
          listView?.addEventListener('scroll', onListViewScroll);
        }
      }, 3500);
      return () => {
        scrollView?.removeEventListener('scroll', onScroll);
      };
    }
  }, [scrollViewRef]);

  if (!tokenListState.initialized && tokenListState.isRefreshing) {
    return <ListLoading onContentSizeChange={onContentSizeChange} />;
  }

  return (
    <ListView
      py={withPresetVerticalPadding ? '$3' : '$0'}
      estimatedItemSize={tableLayout ? 48 : 60}
      ref={listViewRef}
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
