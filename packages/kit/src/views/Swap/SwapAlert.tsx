import type { FC } from 'react';
import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useCreateAccountInWallet } from '../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNetworkSimple,
} from '../../hooks';

import { useInputLimitsError } from './hooks/useSwap';
import { SwapError } from './typings';

const RecipientBox = () => {
  const intl = useIntl();
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const { wallet } = useActiveWalletAccount();
  const network = useNetworkSimple(outputToken?.networkId);
  const { createAccount } = useCreateAccountInWallet({
    networkId: network?.id,
    walletId: wallet?.id,
  });
  const accounts = useAppSelector((s) => s.runtime.accounts);

  useEffect(() => {
    if (network) {
      backgroundApiProxy.serviceSwap.setRecipient(network);
    }
  }, [accounts, network]);

  return (
    <Box mt="6">
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__you_don_t_have_a_str_account',
          },
          { '0': network?.symbol ?? '' },
        )}
        alertType="info"
        actionType="right"
        action={intl.formatMessage({ id: 'action__create' })}
        onAction={createAccount}
        dismiss={false}
      />
    </Box>
  );
};

const RecipientAlert = () => {
  const recipient = useAppSelector((s) => s.swap.recipient);
  if (recipient) {
    return null;
  }
  return <RecipientBox />;
};

const DepositLimitAlert = () => {
  const limitsError = useInputLimitsError();
  const intl = useIntl();
  const onAction = useCallback(() => {
    if (limitsError?.value) {
      backgroundApiProxy.serviceSwap.userInput('INPUT', limitsError.value);
    }
  }, [limitsError]);
  if (limitsError) {
    return (
      <Box mt="6">
        <Alert
          title={limitsError.message}
          alertType="warn"
          dismiss={false}
          actionType="right"
          onAction={onAction}
          action={intl.formatMessage({ id: 'action__fill_in' })}
        />
      </Box>
    );
  }
  return null;
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
  return null;
};

const SwapWarning: FC = () => (
  <>
    <DepositLimitAlert />
    <RecipientAlert />
    <ErrorAlert />
  </>
);

export default SwapWarning;
