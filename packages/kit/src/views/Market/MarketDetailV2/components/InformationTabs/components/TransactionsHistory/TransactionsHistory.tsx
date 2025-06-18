import { useCallback } from 'react';

import { ListView, SizableText, Stack } from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
import { useMarketTransactions } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketTransactions';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionItem } from './TransactionItem';
import { TransactionsHeader } from './TransactionsHeader';
import { TransactionsSkeleton } from './TransactionsSkeleton';

interface ITransactionsHistoryProps {
  tokenAddress: string;
  networkId: string;
}

export function TransactionsHistory({
  tokenAddress,
  networkId,
}: ITransactionsHistoryProps) {
  const { transactions, isRefreshing } = useMarketTransactions({
    tokenAddress,
    networkId,
  });

  const renderItem: IListViewProps<IMarketTokenTransaction>['renderItem'] =
    useCallback(({ item }: { item: IMarketTokenTransaction }) => {
      return <TransactionItem item={item} />;
    }, []);

  if (isRefreshing && transactions.length === 0) {
    return <TransactionsSkeleton />;
  }

  if (!isRefreshing && transactions.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          No transactions found
        </SizableText>
      </Stack>
    );
  }

  return (
    <ListView<IMarketTokenTransaction>
      data={transactions}
      renderItem={renderItem}
      keyExtractor={(item) => item.hash}
      estimatedItemSize={80}
      showsVerticalScrollIndicator
      ListHeaderComponent={TransactionsHeader}
      contentContainerStyle={{
        paddingBottom: '$4',
      }}
    />
  );
}
