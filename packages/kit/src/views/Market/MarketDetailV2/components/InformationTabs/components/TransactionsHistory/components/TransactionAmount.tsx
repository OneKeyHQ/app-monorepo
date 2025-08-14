import { type ComponentProps, memo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

interface ITransactionAmountProps {
  baseToken: {
    amount: string;
    symbol: string;
  };
  quoteToken: {
    amount: string;
    symbol: string;
  };
  baseSign: string;
  quoteSign: string;
  typeColor: string;
  style?: ComponentProps<typeof XStack>;
}

function TransactionAmountBase({
  baseToken,
  quoteToken,
  baseSign,
  quoteSign,
  typeColor,
  style,
}: ITransactionAmountProps) {
  return (
    <XStack {...style} alignItems="center" justifyContent="flex-start" gap="$1">
      <YStack width="49%" alignItems="flex-end">
        <XStack>
          <SizableText size="$bodyMd" color={typeColor} numberOfLines={1}>
            {`${baseSign}`}
          </SizableText>

          <NumberSizeableText
            size="$bodyMd"
            autoFormatter="value-marketCap"
            color={typeColor}
          >
            {baseToken.amount}
          </NumberSizeableText>
        </XStack>

        <XStack>
          <SizableText size="$bodyMd" numberOfLines={1}>
            {`${quoteSign}`}
          </SizableText>

          <NumberSizeableText autoFormatter="value-marketCap" size="$bodyMd">
            {quoteToken.amount}
          </NumberSizeableText>
        </XStack>
      </YStack>

      <YStack width="49%" alignItems="flex-start">
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {baseToken.symbol}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {quoteToken.symbol}
        </SizableText>
      </YStack>
    </XStack>
  );
}

const TransactionAmount = memo(TransactionAmountBase);

export { TransactionAmount };
