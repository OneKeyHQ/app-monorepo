import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import { useDepositLimit, useSwap, useSwapEnabled } from './hooks/useSwap';
import { SwapError } from './typings';

const DepositLimitAlert = () => {
  const { limited, message } = useDepositLimit();
  if (limited) {
    return (
      <Box mb="6">
        <Alert title={message} alertType="warn" dismiss={false} />
      </Box>
    );
  }
  return <></>;
};

const NetworkDisabledAlert = () => {
  const intl = useIntl();
  const isSwapEnabled = useSwapEnabled();
  if (!isSwapEnabled) {
    return (
      <Box mb="6">
        <Alert
          title={intl.formatMessage({ id: 'msg__wrong_network' })}
          description={intl.formatMessage({
            id: 'msg__wrong_network_desc',
          })}
          alertType="error"
          dismiss={false}
        />
      </Box>
    );
  }
  return <></>;
};

const ErrorAlert = () => {
  const intl = useIntl();
  const { error } = useSwap();
  if (error === SwapError.NotSupport) {
    return (
      <Box mb="6">
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
      <Box mb="6">
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
    <NetworkDisabledAlert />
    <ErrorAlert />
  </>
);

export default SwapWarning;
