import { memo } from 'react';

import { NumberSizeableText, XStack, YStack } from '@onekeyhq/components';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionAmount } from '../../components/TransactionAmount';
import { TransactionTime } from '../../components/TransactionTime';
import { TransactionType } from '../../components/TransactionType';
import { useTransactionItemData } from '../../hooks/useTransactionItemData';

import { useTransactionsLayoutSmall } from './useTransactionsLayoutSmall';

interface ITransactionItemSmallProps {
  item: IMarketTokenTransaction;
  networkId: string;
}

function TransactionItemSmallBase({
  item,
  networkId,
}: ITransactionItemSmallProps) {
  const { styles } = useTransactionsLayoutSmall();
  const {
    baseToken,
    quoteToken,
    baseSign,
    quoteSign,
    typeColor,
    typeText,
    price,
    value,
    formatRelativeTime,
  } = useTransactionItemData({ item, networkId });

  return (
    <XStack py="$1" px="$4" alignItems="center">
      <YStack {...styles.time}>
        <TransactionType typeText={typeText} typeColor={typeColor} />
        <TransactionTime
          timestamp={item.timestamp}
          formatRelativeTime={formatRelativeTime}
        />
      </YStack>

      <TransactionAmount
        baseToken={baseToken}
        quoteToken={quoteToken}
        baseSign={baseSign}
        quoteSign={quoteSign}
        typeColor={typeColor}
        style={styles.amount}
      />

      <YStack {...styles.price} justifyContent="flex-end">
        <NumberSizeableText
          textAlign="right"
          size="$bodySmMedium"
          color="$text"
          formatter="marketCap"
          formatterOptions={{ currency: '$', capAtMaxT: true }}
        >
          {value}
        </NumberSizeableText>

        <NumberSizeableText
          textAlign="right"
          size="$bodySm"
          color="$textSubdued"
          formatter="marketCap"
          formatterOptions={{ currency: '$', capAtMaxT: true }}
        >
          {price}
        </NumberSizeableText>
      </YStack>
    </XStack>
  );
}

const TransactionItemSmall = memo(TransactionItemSmallBase);

export { TransactionItemSmall };
