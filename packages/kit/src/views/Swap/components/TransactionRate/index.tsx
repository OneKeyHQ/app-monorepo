import React, { FC, useState } from 'react';

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
    title = `1${symbolA} = ${formatAmount(rate, 8)}${symbolB}`;
  } else {
    title = `1${symbolB} = ${formatAmount(1 / Number(rate), 8)}${symbolA}`;
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
