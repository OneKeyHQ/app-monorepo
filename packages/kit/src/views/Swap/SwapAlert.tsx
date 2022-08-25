import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../hooks';

import { enabledNetworkIds } from './config';
import { useInputLimitsError, useSwapState } from './hooks/useSwap';
import { SwapError } from './typings';

const NetworkDisabledAlert = () => {
  const intl = useIntl();
  const { network } = useActiveWalletAccount();
  if (!network || !enabledNetworkIds.includes(network.id)) {
    return (
      <Box mt="6">
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
  const { error } = useSwapState();
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
    <NetworkDisabledAlert />
    <DepositLimitAlert />
    <ErrorAlert />
  </>
);

export default SwapWarning;
