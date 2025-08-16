import { useCallback, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import {
  SizableText,
  Stack,
  Tabs,
  useCurrentTabScrollY,
  useMedia,
} from '@onekeyhq/components';
import { useLeftColumnWidthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketTransactions } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketTransactions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionsSkeleton } from './components/TransactionsSkeleton';
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
  const intl = useIntl();
  const { gtLg } = useMedia();
  const [leftColumnWidth] = useLeftColumnWidthAtom();
  const { transactions, isRefreshing } = useMarketTransactions({
    tokenAddress,
    networkId,
  });
  // const listRef = useRef<FlashListRef<IMarketTokenTransaction>>(null);
  // const [hasUserScrolled, setHasUserScrolled] = useState(false);

  const shouldEnableScroll = leftColumnWidth < 930;

  // Scroll to top when transactions update, only if user hasn't scrolled
  // useEffect(() => {
  //   if (transactions.length > 0 && listRef.current && !hasUserScrolled) {
  //     listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  //   }
  // }, [transactions, hasUserScrolled]);

  const renderItem: FlatListProps<IMarketTokenTransaction>['renderItem'] =
    useCallback(
      ({ item }: { item: IMarketTokenTransaction }) => {
        return gtLg ? (
          <TransactionItemNormal item={item} networkId={networkId} />
        ) : (
          <TransactionItemSmall item={item} />
        );
      },
      [networkId, gtLg],
    );

  const keyExtractor = useCallback(
    (item: IMarketTokenTransaction) => item.hash,
    [],
  );

  const handleEndReached = useCallback(() => {
    console.log('handleEndReached');
  }, []);

  useScrollEnd(onScrollEnd ?? noop);

  return (
    <Tabs.FlatList<IMarketTokenTransaction>
      // ref={listRef}
      onEndReached={handleEndReached}
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
      contentContainerStyle={{
        paddingBottom: 16,
      }}
    />
  );
}
