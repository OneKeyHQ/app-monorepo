import React, { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';

import { TransactionDetails } from '../../typings';

type TransactionStatusProps = { tx: TransactionDetails } & ComponentProps<
  typeof Box
>;

const TransactionStatus: FC<TransactionStatusProps> = ({ tx, ...rest }) => {
  const intl = useIntl();
  return (
    <Box {...rest}>
      {tx.status === 'pending' ? (
        <Typography.Body2 color="text-warning" mr="1">
          {intl.formatMessage({ id: 'transaction__pending' })}
        </Typography.Body2>
      ) : null}
      {tx.status === 'failed' ? (
        <Typography.Body2 color="text-critical" mr="1">
          {intl.formatMessage({ id: 'transaction__failed' })}
        </Typography.Body2>
      ) : null}
      {tx.status === 'canceled' ? (
        <Typography.Body2 color="text-critical" mr="1">
          {/* TODO: cancel i18n and color */}
          {intl.formatMessage({ id: 'transaction__failed' })}
        </Typography.Body2>
      ) : null}
    </Box>
  );
};

export default TransactionStatus;
