import { useCallback } from 'react';

import {
  ListView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
import { useMarketTransactions } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketTransactions';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface ITransactionsHistoryProps {
  tokenAddress: string;
  networkId: string;
}

function TransactionItem({ item }: { item: IMarketTokenTransaction }) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num < 0.001) {
      return num.toExponential(2);
    }
    return num.toFixed(4);
  };

  return (
    <XStack
      py="$3"
      px="$4"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      alignItems="center"
      justifyContent="space-between"
    >
      <YStack flex={1}>
        <XStack alignItems="center" gap="$2">
          <SizableText
            size="$bodyMdMedium"
            color={item.type === 'buy' ? '$textSuccess' : '$textCritical'}
          >
            {item.type.toUpperCase()}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {formatTime(item.timestamp)}
          </SizableText>
        </XStack>
        <XStack alignItems="center" gap="$1" mt="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {formatAmount(item.from.amount)} {item.from.symbol}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            →
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {formatAmount(item.to.amount)} {item.to.symbol}
          </SizableText>
        </XStack>
      </YStack>
      <YStack alignItems="flex-end">
        <SizableText size="$bodyMd" color="$text">
          ${parseFloat(item.from.price).toFixed(2)}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          $
          {(parseFloat(item.from.amount) * parseFloat(item.from.price)).toFixed(
            2,
          )}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function TransactionsSkeleton() {
  return (
    <YStack space="$3" p="$4">
      {Array.from({ length: 5 }).map((_, index) => (
        <XStack key={index} alignItems="center" justifyContent="space-between">
          <YStack space="$2" flex={1}>
            <Skeleton height="$4" width="$16" />
            <Skeleton height="$3" width="$24" />
          </YStack>
          <YStack space="$2" alignItems="flex-end">
            <Skeleton height="$4" width="$12" />
            <Skeleton height="$3" width="$16" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
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
      return <TransactionItem key={item.hash} item={item} />;
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
      contentContainerStyle={{
        paddingBottom: '$4',
      }}
    />
  );
}
