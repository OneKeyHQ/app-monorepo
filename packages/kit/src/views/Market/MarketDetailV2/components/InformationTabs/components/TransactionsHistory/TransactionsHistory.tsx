import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  ScrollView,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
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
  const { gtXl } = useMedia();
  const { transactions, isRefreshing } = useMarketTransactions({
    tokenAddress,
    networkId,
  });

  const renderItem: IListViewProps<IMarketTokenTransaction>['renderItem'] =
    useCallback(
      ({ item }: { item: IMarketTokenTransaction }) => {
        return gtXl ? (
          <TransactionItemNormal item={item} networkId={networkId} />
        ) : (
          <TransactionItemSmall item={item} networkId={networkId} />
        );
      },
      [networkId, gtXl],
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
    <ListView<IMarketTokenTransaction>
      data={transactions}
      renderItem={renderItem}
      keyExtractor={(item) => item.hash}
      estimatedItemSize={40}
      showsVerticalScrollIndicator
      ListHeaderComponent={
        gtXl ? TransactionsHeaderNormal : TransactionsHeaderSmall
      }
      stickyHeaderIndices={[0]}
      contentContainerStyle={{
        paddingBottom: '$4',
      }}
    />
  );

  if (gtXl) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexDirection: 'column',
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {list}
      </ScrollView>
    );
  }

  return list;
}
