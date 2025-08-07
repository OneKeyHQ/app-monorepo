import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  ScrollView,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import type { IListViewProps, IListViewRef } from '@onekeyhq/components';
import { useLeftColumnWidthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketTransactions } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketTransactions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionsSkeleton } from './components/TransactionsSkeleton';
import { TransactionItemNormal } from './layout/TransactionItemNormal/TransactionItemNormal';
import { TransactionsHeaderNormal } from './layout/TransactionItemNormal/TransactionsHeaderNormal';
import { TransactionItemSmall } from './layout/TransactionItemSmall/TransactionItemSmall';
import { TransactionsHeaderSmall } from './layout/TransactionItemSmall/TransactionsHeaderSmall';

interface ITransactionsHistoryProps {
  tokenAddress: string;
  networkId: string;
}

export function TransactionsHistory({
  tokenAddress,
  networkId,
}: ITransactionsHistoryProps) {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const [leftColumnWidth] = useLeftColumnWidthAtom();
  const { transactions, isRefreshing } = useMarketTransactions({
    tokenAddress,
    networkId,
  });
  const listRef = useRef<IListViewRef<IMarketTokenTransaction>>(null);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);

  const shouldEnableScroll = leftColumnWidth < 930;

  // Scroll to top when transactions update, only if user hasn't scrolled
  useEffect(() => {
    if (transactions.length > 0 && listRef.current && !hasUserScrolled) {
      listRef.current.scrollToOffset({ animated: false, offset: 0 });
    }
  }, [transactions, hasUserScrolled]);

  const renderItem: IListViewProps<IMarketTokenTransaction>['renderItem'] =
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

  const handleScroll = useCallback(
    (e: {
      nativeEvent?: {
        contentOffset?: {
          y?: number;
        };
      };
    }) => {
      const scrollY = e.nativeEvent?.contentOffset?.y || 0;
      console.log('Transactions list scroll distance:', scrollY);

      // Mark as user scrolled if scroll distance > 10
      if (scrollY > 10 && !hasUserScrolled) {
        setHasUserScrolled(true);
      } else if (scrollY <= 10 && hasUserScrolled) {
        // Reset if user scrolls back to near top
        setHasUserScrolled(false);
      }
    },
    [hasUserScrolled],
  );

  if (isRefreshing && transactions.length === 0) {
    return <TransactionsSkeleton />;
  }

  if (!isRefreshing && transactions.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_nodata,
          })}
        </SizableText>
      </Stack>
    );
  }

  const list = (
    <Stack flex={1}>
      {gtLg ? <TransactionsHeaderNormal /> : <TransactionsHeaderSmall />}
      <ListView<IMarketTokenTransaction>
        ref={listRef}
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.hash}
        showsVerticalScrollIndicator
        onScroll={handleScroll}
        contentContainerStyle={{
          paddingBottom: '$4',
        }}
      />
    </Stack>
  );

  if (gtLg && shouldEnableScroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {list}
      </ScrollView>
    );
  }

  return list;
}
