import { SizableText, XStack } from '@onekeyhq/components';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

export interface IBalanceDisplayProps {
  balance?: BigNumber;
  token?: IToken;
}

export function BalanceDisplay({ balance, token }: IBalanceDisplayProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        Balance
      </SizableText>
      <SizableText size="$bodyMdMedium">
        {balance?.toFixed() || '-'} {token?.symbol || ''}
      </SizableText>
    </XStack>
  );
}
