import { FC } from 'react';

import { Typography } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useTokenAmount } from '../hooks/useSwap';
import { QuoteLimited } from '../typings';

type AmountLimitProps = {
  limited?: QuoteLimited;
  token?: Token;
};

export const AmountLimit: FC<AmountLimitProps> = ({ limited, token }) => {
  const maxAmount = useTokenAmount(token, limited?.max);
  const minAmount = useTokenAmount(token, limited?.min);

  if (!limited || !token) {
    return null;
  }
  if (limited.max) {
    return (
      <Typography.Caption color="text-subdued">
        Max Amount: {maxAmount?.typedValue}
        {token?.symbol}
      </Typography.Caption>
    );
  }
  if (limited.min) {
    return (
      <Typography.Caption color="text-subdued">
        Min Amount: {minAmount?.typedValue}
        {token?.symbol}
      </Typography.Caption>
    );
  }
  return null;
};
