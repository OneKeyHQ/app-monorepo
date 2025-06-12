import { memo } from 'react';

import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDistanceToNowStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface ITransactionItemProps {
  item: IMarketTokenTransaction;
}

function TransactionItem({ item }: ITransactionItemProps) {
  const { copyText } = useClipboard();

  const handleCopyAddress = () => {
    copyText(item.owner);
  };

  // Display relative time like "3 minutes" / "2 hours" without suffix.
  const formatRelativeTime = (timestamp: number) =>
    formatDistanceToNowStrict(timestamp * 1000, {
      addSuffix: false,
      roundingMethod: 'floor',
    });

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (Math.abs(num) < 0.001) {
      return num.toExponential(2);
    }
    return numberFormat(amount, { formatter: 'balance' }) as string;
  };

  const isBuy = item.type === 'buy';
  const baseToken = isBuy ? item.to : item.from;
  const quoteToken = isBuy ? item.from : item.to;

  const baseSign = isBuy ? '+' : '-';
  const quoteSign = isBuy ? '-' : '+';
  const typeColor = isBuy ? '$textSuccess' : '$textCritical';

  return (
    <XStack
      py="$3"
      px="$4"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      alignItems="center"
      gap="$3"
    >
      {/* Time */}
      <SizableText size="$bodyMd" color="$textSubdued" minWidth="$10">
        {formatRelativeTime(item.timestamp)}
      </SizableText>

      {/* Type */}
      <SizableText size="$bodyMdMedium" color={typeColor} minWidth="$10">
        {isBuy ? 'Buy' : 'Sell'}
      </SizableText>

      {/* Amount - 2 columns (YStack) x 2 rows layout */}
      <XStack
        flex={1}
        minWidth="$32"
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        {/* Column 1: amounts */}
        <YStack w="50%" alignItems="flex-end" gap="$1">
          <SizableText size="$bodySm" color={typeColor} numberOfLines={1}>
            {`${baseSign}${formatAmount(baseToken.amount)}`}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {`${quoteSign}${formatAmount(quoteToken.amount)}`}
          </SizableText>
        </YStack>

        {/* Column 2: symbols */}
        <YStack w="50%" alignItems="flex-start" gap="$1">
          <SizableText size="$bodySm" color={typeColor} numberOfLines={1}>
            {baseToken.symbol}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {quoteToken.symbol}
          </SizableText>
        </YStack>
      </XStack>

      {/* Price */}
      <SizableText
        size="$bodyMd"
        color="$text"
        minWidth="$14"
        textAlign="right"
      >
        ${parseFloat(item.from.price).toFixed(2)}
      </SizableText>

      {/* Value */}
      <SizableText
        size="$bodyMd"
        color="$text"
        minWidth="$16"
        textAlign="right"
      >
        $
        {(parseFloat(item.from.amount) * parseFloat(item.from.price)).toFixed(
          2,
        )}
      </SizableText>

      {/* Address */}
      <XStack
        onPress={handleCopyAddress}
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        borderRadius="$2"
        px="$2"
        py="$1"
        alignItems="center"
        gap="$1"
        minWidth="$24"
        flexShrink={1}
      >
        <SizableText
          fontFamily="$monoRegular"
          size="$bodyMd"
          color="$text"
          numberOfLines={1}
          flexShrink={1}
        >
          {accountUtils.shortenAddress({
            address: item.owner,
            leadingLength: 6,
            trailingLength: 4,
          })}
        </SizableText>
        <Icon name="Copy2Outline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}

export default memo(TransactionItem);
