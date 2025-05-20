import { SizableText, XStack } from '@onekeyhq/components';

import type BigNumber from 'bignumber.js';

export interface IBalanceDisplayProps {
  balance?: BigNumber;
  token?: {
    symbol: string;
  };
}

export function BalanceDisplay({ balance, token }: IBalanceDisplayProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        Balance
      </SizableText>
      <SizableText size="$bodyMdMedium">
        {balance || '-'} {token?.symbol || ''}
      </SizableText>
    </XStack>
  );
}
