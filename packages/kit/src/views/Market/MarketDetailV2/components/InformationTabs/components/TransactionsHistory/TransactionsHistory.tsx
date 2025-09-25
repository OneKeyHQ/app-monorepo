import { useCallback, useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import {
  SizableText,
  Spinner,
  Stack,
  Tabs,
  useCurrentTabScrollY,
  useMedia,
} from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionsSkeleton } from './components/TransactionsSkeleton';
import { useMarketTransactions } from './hooks/useMarketTransactions';
import { useTransactionsWebSocket } from './hooks/useTransactionsWebSocket';
import { TransactionItemNormal } from './layout/TransactionItemNormal/TransactionItemNormal';
import { TransactionItemSmall } from './layout/TransactionItemSmall/TransactionItemSmall';

import type { FlatListProps } from 'react-native';

interface ITransactionsHistoryProps {
  tokenAddress: string;
  networkId: string;
  onScrollEnd?: () => void;
}

const useScrollEnd = platformEnv.isNative
  ? (onScrollEnd: () => void) => {
      const scrollY = useCurrentTabScrollY();

      const debouncedOnScrollEnd = useDebouncedCallback(onScrollEnd, 150);

      useAnimatedReaction(
        () => scrollY.value,
        (current, prev) => {
          if (current !== prev) {
            runOnJS(debouncedOnScrollEnd)();
          }
        },
        [onScrollEnd],
      );
    }
  : () => {};

export function TransactionsHistory({
  tokenAddress,
  networkId,
  onScrollEnd,
}: ITransactionsHistoryProps) {
  const { websocketConfig } = useTokenDetail();
  const isVisible = useRouteIsFocused();
  const { gtXl } = useMedia();

  const normalMode =
    !platformEnv.isNative && !gtXl && !(websocketConfig?.txs ?? false);

  const intl = useIntl();
  const {
    transactions,
    isRefreshing,
    isLoadingMore,
    hasMore,
    loadMore,
    addNewTransaction,
  } = useMarketTransactions({
    tokenAddress,
    networkId,
    normalMode,
  });

  // Subscribe to real-time transaction updates
  // Only enable if websocket.txs is enabled and other conditions are met
  useTransactionsWebSocket({
    networkId,
    tokenAddress,
    enabled: !normalMode && isVisible,
    onNewTransaction: addNewTransaction,
  });

  const listKey = useMemo(() => {
    return `${networkId}-${tokenAddress}`;
  }, [networkId, tokenAddress]);

  const renderItem: FlatListProps<IMarketTokenTransaction>['renderItem'] =
    useCallback(
      ({ item }: { item: IMarketTokenTransaction }) => {
        return gtXl ? (
          <TransactionItemNormal item={item} networkId={networkId} />
        ) : (
          <TransactionItemSmall item={item} />
        );
      },
      [networkId, gtXl],
    );

  const keyExtractor = useCallback(
    (item: IMarketTokenTransaction) => item.hash,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  useScrollEnd(onScrollEnd ?? noop);

  return (
    <Tabs.FlatList<IMarketTokenTransaction>
      key={listKey}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.2}
      data={transactions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      showsVerticalScrollIndicator
      ListEmptyComponent={
        isRefreshing ? (
          <TransactionsSkeleton />
        ) : (
          <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.dexmarket_details_nodata,
              })}
            </SizableText>
          </Stack>
        )
      }
      ListFooterComponent={
        isLoadingMore ? (
          <Stack p="$4" alignItems="center" gap="$2">
            <Spinner size="small" />
          </Stack>
        ) : null
      }
      contentContainerStyle={{
        paddingBottom: platformEnv.isNativeAndroid ? 48 : 16,
      }}
    />
  );
}
