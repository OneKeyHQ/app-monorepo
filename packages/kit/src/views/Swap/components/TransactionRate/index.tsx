import React, { FC, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, Pressable, Text, Typography } from '@onekeyhq/components';
import { TypographyStyle } from '@onekeyhq/components/src/Typography';
import { Token } from '@onekeyhq/engine/src/types/token';

import { formatAmount } from '../../utils';

type TransactionRateProps = {
  tokenA?: Token;
  tokenB?: Token;
  rate?: number | string;
  typography?: TypographyStyle;
};

const formatRateAmount = (amount: string | number) => {
  const value = formatAmount(amount, 8);
  const bn = new BigNumber(value);
  if (bn.isZero()) return formatAmount(amount, 16);
  if (bn.isGreaterThan(1 * 10 ** 9)) return formatAmount(amount, 0);
  return value;
};

const TransactionRate: FC<TransactionRateProps> = ({
  tokenA,
  tokenB,
  rate,
  typography = 'Body2',
}) => {
  const [isSwitched, setSwitched] = useState(false);
  if (!tokenA || !tokenB || !rate) {
    return <Typography.Body2 color="text-default">---</Typography.Body2>;
  }
  const symbolA = tokenA.symbol;
  const symbolB = tokenB.symbol;
  let title = '';
  if (!isSwitched) {
    title = `1${symbolA} ≈ ${formatRateAmount(rate)}${symbolB}`;
  } else {
    title = `1${symbolB} ≈ ${formatRateAmount(1 / Number(rate))}${symbolA}`;
  }

  return (
    <Pressable
      flexDirection="row"
      alignItems="center"
      onPress={() => setSwitched((v) => !v)}
    >
      <Text
        typography={typography}
        color="text-default"
        textAlign="right"
        mr="1"
      >
        {title}
      </Text>
      <Icon size={20} name="SwitchHorizontalSolid" />
    </Pressable>
  );
};

export default TransactionRate;
