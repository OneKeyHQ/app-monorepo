import type { ComponentProps, FC } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Text } from '@onekeyhq/components';

import { QuoterType } from '../../typings';

function formatPercentageFee(percentageFee?: string): string {
  if (!percentageFee) return '0';
  let bn = new BigNumber(percentageFee);
  bn = bn.multipliedBy(100);
  return bn.isNaN() ? '0' : bn.toFixed();
}

function isNoCharge(type?: QuoterType): boolean {
  if (!type) return false;
  const list: QuoterType[] = [QuoterType.mdex];
  return list.includes(type);
}

type TransactionFeeProps = {
  type?: QuoterType;
  percentageFee?: string;
  typography?: ComponentProps<typeof Text>['typography'];
  color?: ComponentProps<typeof Text>['color'];
};

const TransactionFee: FC<TransactionFeeProps> = ({
  type,
  percentageFee,
  typography = 'Caption',
  color = 'text-subdued',
}) => {
  const intl = useIntl();
  return (
    <Box>
      {isNoCharge(type) || (percentageFee && Number(percentageFee) === 0) ? (
        <Box flexDirection="column" alignItems="flex-end">
          <Text typography={typography} color={color} strikeThrough>
            0.3%
          </Text>
          <Text typography={typography} color={color}>
            {intl.formatMessage({ id: 'form__free_limited_time' })}
          </Text>
        </Box>
      ) : (
        <Text typography={typography} color={color}>
          {!percentageFee ? ' 0.3%' : `${formatPercentageFee(percentageFee)}%`}
        </Text>
      )}
    </Box>
  );
};

export default TransactionFee;
