import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import { useAppSelector } from '../../hooks';

import { useInputLimitsError } from './hooks/useSwap';
import { SwapError } from './typings';

const DepositLimitAlert = () => {
  const limitsError = useInputLimitsError();
  if (limitsError) {
    return (
      <Box mt="6">
        <Alert title={limitsError.message} alertType="warn" dismiss={false} />
      </Box>
    );
  }
  return <></>;
};

const ErrorAlert = () => {
  const intl = useIntl();
  const error = useAppSelector((s) => s.swap.error);
  if (error === SwapError.NotSupport) {
    return (
      <Box mt="6">
        <Alert
          title={intl.formatMessage({
            id: 'msg__this_transaction_is_not_supported',
          })}
          alertType="warn"
          dismiss={false}
        />
      </Box>
    );
  }
  if (error === SwapError.QuoteFailed) {
    return (
      <Box mt="6">
        <Alert
          title={intl.formatMessage({
            id: 'msg__failed_to_get_price',
          })}
          alertType="warn"
          dismiss={false}
        />
      </Box>
    );
  }
  return <></>;
};

const SwapWarning: FC = () => (
  <>
    <DepositLimitAlert />
    <ErrorAlert />
  </>
);

export default SwapWarning;
