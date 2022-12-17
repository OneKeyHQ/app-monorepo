import type { FC } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';

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

const TransactionFee: FC<{ type?: QuoterType; percentageFee?: string }> = ({
  type,
  percentageFee,
}) => {
  const intl = useIntl();
  return (
    <Box>
      {isNoCharge(type) || (percentageFee && Number(percentageFee) === 0) ? (
        <Box flexDirection="column" alignItems="flex-end">
          <Typography.Caption color="text-subdued" strikeThrough>
            0.2 - 0.875%
          </Typography.Caption>
          <Typography.Caption color="text-success">
            {intl.formatMessage({ id: 'form__free_limited_time' })}
          </Typography.Caption>
        </Box>
      ) : (
        <Typography.Caption color="text-subdued">
          {!percentageFee
            ? ' 0.2 - 0.875%'
            : `${formatPercentageFee(percentageFee)}%`}
        </Typography.Caption>
      )}
    </Box>
  );
};

export default TransactionFee;
