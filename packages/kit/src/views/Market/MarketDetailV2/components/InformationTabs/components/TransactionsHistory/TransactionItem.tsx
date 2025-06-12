import { memo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface ITransactionItemProps {
  item: IMarketTokenTransaction;
}

function TransactionItem({ item }: ITransactionItemProps) {
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

export default memo(TransactionItem);
