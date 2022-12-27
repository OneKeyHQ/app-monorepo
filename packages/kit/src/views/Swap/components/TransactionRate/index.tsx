import type { ComponentProps, FC } from 'react';
import { useState } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, Pressable, Text } from '@onekeyhq/components';
import type { TypographyStyle } from '@onekeyhq/components/src/Typography';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { formatAmount } from '../../utils';

type TransactionRateProps = {
  tokenA?: Token;
  tokenB?: Token;
  rate?: number | string;
  typography?: TypographyStyle;
  color?: ComponentProps<typeof Text>['color'];
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
  color = 'text-default',
}) => {
  const [isSwitched, setSwitched] = useState(false);
  if (!tokenA || !tokenB || !rate) {
    return (
      <Text typography={typography} color={color}>
        ---
      </Text>
    );
  }
  const symbolA = tokenA.symbol;
  const symbolB = tokenB.symbol;
  let title = '';
  if (!isSwitched) {
    title = `1 ${symbolA} ≈ ${formatRateAmount(rate)} ${symbolB}`;
  } else {
    title = `1 ${symbolB} ≈ ${formatRateAmount(1 / Number(rate))} ${symbolA}`;
  }

  return (
    <Pressable
      flexDirection="row"
      alignItems="center"
      onPress={() => setSwitched((v) => !v)}
    >
      <Text
        typography={typography}
        color={color}
        textAlign="right"
        mr="1"
        selectable={false}
      >
        {title}
      </Text>
      <Icon size={16} name="ArrowsRightLeftMini" color="icon-subdued" />
    </Pressable>
  );
};

export default TransactionRate;
