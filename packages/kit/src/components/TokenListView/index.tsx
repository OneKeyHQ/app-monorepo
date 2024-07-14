import { useEffect, useMemo, useRef } from 'react';

import type { IListViewRef } from '@onekeyhq/components';
import { ListView, Stack, useTabScrollViewRef } from '@onekeyhq/components';
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

  const scrollViewRef = useTabScrollViewRef();
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);

  useEffect(() => {
    if (!platformEnv.isNative) {
      let lastScrollTop = 0;
      let isBindListViewEvent = false;
      let listView: HTMLDivElement | undefined;
      const scrollView = scrollViewRef?.current as unknown as HTMLElement;
      const onListViewScroll = () => {
        // If lastScrollTop >= scrollTop, it means the listView is scrolling up.
        if (!listView) {
          return;
        }
        const { scrollTop } = listView;
        if (lastScrollTop >= scrollTop && scrollTop === 0) {
          listView.style.overflowY = 'hidden';
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      };
      const onScroll = () => {
        if (!isBindListViewEvent) {
          isBindListViewEvent = true;
          listView = (
            listViewRef.current as unknown as {
              _listRef?: { _scrollRef: HTMLDivElement };
            }
          )?._listRef?._scrollRef;
          if (listView) {
            listView?.addEventListener('scroll', onListViewScroll);
          }
        }
        const { scrollTop, scrollHeight, clientHeight } = scrollView;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight;
        if (listView) {
          if (isNearBottom) {
            listView.style.overflowY = 'scroll';
          } else {
            listView.style.overflowY = 'hidden';
          }
        }
      };

      scrollView?.addEventListener('scroll', onScroll);
      return () => {
        scrollView?.removeEventListener('scroll', onScroll);
        listView?.removeEventListener('scroll', onListViewScroll);
      };
    }
  }, [scrollViewRef]);

  const listViewProps = useMemo(
    () =>
      platformEnv.isNative
        ? { onContentSizeChange }
        : {
            style: {
              overflowY: 'hidden',
            },
          },
    [onContentSizeChange],
  );

  if (!tokenListState.initialized && tokenListState.isRefreshing) {
    return <ListLoading onContentSizeChange={onContentSizeChange} />;
  }

  return (
    <ListView
      {...listViewProps}
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
