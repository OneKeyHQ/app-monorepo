import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { ListView, Spinner, Stack } from '@onekeyhq/components';
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

function BasicTokenListView(props: IProps) {
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

  const filteredTokens = useMemo(
    () => getFilteredTokenBySearchKey({ tokens, searchKey }),
    [searchKey, tokens],
  );

  const listHeaderComponent = useMemo(
    () =>
      withHeader && tokens.length > 0 ? (
        <TokenListHeader
          filteredTokens={filteredTokens}
          tokens={tokens}
          tableLayout={tableLayout}
        />
      ) : null,
    [filteredTokens, tableLayout, tokens, withHeader],
  );

  const listEmptyComponent = useMemo(
    () =>
      searchKey ? (
        EmptySearch
      ) : (
        <EmptyToken
          withBuyAndReceive={withBuyAndReceive}
          isBuyTokenSupported={isBuyTokenSupported}
          onBuy={onBuyToken}
          onReceive={onReceiveToken}
        />
      ),
    [
      isBuyTokenSupported,
      onBuyToken,
      onReceiveToken,
      searchKey,
      withBuyAndReceive,
    ],
  );

  const listFooterComponent = useMemo(
    () => (
      <Stack pb="$5">
        {withFooter ? <TokenListFooter tableLayout={tableLayout} /> : null}
      </Stack>
    ),
    [tableLayout, withFooter],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: IAccountToken; index: number }) => (
      <TokenListItem
        token={item}
        key={item.$key}
        index={index}
        onPress={onPressToken}
        tableLayout={tableLayout}
        withPrice={withPrice}
      />
    ),
    [onPressToken, tableLayout, withPrice],
  );

  if (!tokenListState.initialized && tokenListState.isRefreshing) {
    return <ListLoading onContentSizeChange={onContentSizeChange} />;
  }

  console.log(filteredTokens.length);
  return (
    <ListView
      py={withPresetVerticalPadding ? '$3' : '$0'}
      estimatedItemSize={tableLayout ? 48 : 60}
      scrollEnabled={onContentSizeChange ? platformEnv.isWebTouchable : true}
      disableScrollViewPanResponder={!!onContentSizeChange}
      data={filteredTokens}
      ListHeaderComponent={listHeaderComponent}
      // onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={listEmptyComponent}
      renderItem={renderItem}
      ListFooterComponent={listFooterComponent}
      onEndReachedThreshold={0.01}
    />
  );
}

const TokenListView = memo(BasicTokenListView);
export { TokenListView };
