import type { FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';

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
  const { wallet } = useActiveWalletAccount();
  const accounts = useAppSelector((s) => s.runtime.accounts);
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  const network = useNetworkSimple(outputToken?.networkId);
  const { createAccount } = useCreateAccountInWallet({
    networkId: network?.id,
    walletId: wallet?.id,
  });

  const show = useMemo(() => {
    if (!outputToken) {
      return false;
    }
    if (wallet?.accounts.length === 0) {
      return true;
    }
    const result = wallet?.accounts.every(
      (acc) => !isAccountCompatibleWithNetwork(acc, outputToken.networkId),
    );
    return result;
  }, [wallet, outputToken]);

  useEffect(() => {
    if (network) {
      backgroundApiProxy.serviceSwap.setRecipient(network);
    }
  }, [accounts, network]);

  return show ? (
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
  ) : null;
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
