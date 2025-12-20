import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

export interface ITokenValueProps {
  tokenImageUri?: string;
  amount: string | number;
  symbol?: string;
  showToken?: boolean;
}

const MIN_DISPLAY_AMOUNT = 0.01;

export function TokenValue({
  tokenImageUri,
  amount,
  symbol,
  showToken = true,
}: ITokenValueProps) {
  const displayAmount = useMemo(() => {
    const bn = new BigNumber(amount);
    if (bn.isGreaterThan(0) && bn.isLessThan(MIN_DISPLAY_AMOUNT)) {
      return `< ${MIN_DISPLAY_AMOUNT}`;
    }
    return amount;
  }, [amount]);

  const isMinDisplay =
    typeof displayAmount === 'string' && displayAmount.startsWith('<');

  return (
    <XStack gap="$2" ai="center">
      {showToken && tokenImageUri ? (
        <Token size="xs" tokenImageUri={tokenImageUri} />
      ) : null}
      {isMinDisplay ? (
        <SizableText size="$bodyMdMedium">
          {displayAmount} {symbol}
        </SizableText>
      ) : (
        <SizableText size="$bodyMdMedium">
          <NumberSizeableText
            formatter="value"
            size="$bodyMdMedium"
            formatterOptions={{
              tokenSymbol: symbol,
            }}
          >
            {displayAmount}
          </NumberSizeableText>
        </SizableText>
      )}
    </XStack>
  );
}
