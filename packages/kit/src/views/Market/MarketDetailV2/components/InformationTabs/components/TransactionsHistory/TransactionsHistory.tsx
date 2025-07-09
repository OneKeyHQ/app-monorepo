import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListView, SizableText, Stack } from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
import { useMarketTransactions } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketTransactions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
  const { transactions, isRefreshing } = useMarketTransactions({
    tokenAddress,
    networkId,
  });

  const renderItem: IListViewProps<IMarketTokenTransaction>['renderItem'] =
    useCallback(
      ({ item }: { item: IMarketTokenTransaction }) => {
        return <TransactionItem item={item} networkId={networkId} />;
      },
      [networkId],
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

  return (
    <ListView<IMarketTokenTransaction>
      data={transactions}
      renderItem={renderItem}
      keyExtractor={(item) => item.hash}
      estimatedItemSize={40}
      showsVerticalScrollIndicator
      ListHeaderComponent={TransactionsHeader}
      stickyHeaderIndices={[0]}
      contentContainerStyle={{
        paddingBottom: '$4',
      }}
    />
  );
}
