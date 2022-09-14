import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Center } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { archiveTransaction } from '../../../store/reducers/swapTransactions';
import { useSummaryTx } from '../hooks/useSwapUtils';
import { useTransactions } from '../hooks/useTransactions';

const PendingTxs = () => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const allTransactions = useTransactions(accountId);
  const pendings = allTransactions.filter((tx) => tx.status === 'pending');

  return pendings.length ? (
    <Box mt="4">
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__str_transactions_in_progress',
          },
          {
            'content__str_transactions_in_progress': pendings.length,
          },
        )}
        dismiss={false}
        actionType="right"
        alertType="info"
      />
    </Box>
  ) : null;
};

const FailedTxs = () => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const summaryTx = useSummaryTx();
  const allTransactions = useTransactions(accountId);
  const confirmedTxs = allTransactions.filter(
    (tx) => tx.status === 'failed' && !tx.archive,
  );
  const onDismiss = useCallback(() => {
    confirmedTxs.forEach((tx) => {
      backgroundApiProxy.dispatch(
        archiveTransaction({
          accountId: tx.accountId,
          networkId: tx.networkId,
          txs: [tx.hash],
        }),
      );
    });
  }, [confirmedTxs]);
  if (confirmedTxs.length === 0) {
    return <></>;
  }
  if (confirmedTxs.length === 1) {
    return (
      <Box mt="4">
        <Alert
          title={summaryTx(confirmedTxs[0])}
          alertType="error"
          onDismiss={onDismiss}
        />
      </Box>
    );
  }
  return (
    <Box mt="4">
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__str_transactions_failed',
          },
          {
            '0': confirmedTxs.length,
          },
        )}
        alertType="error"
        onDismiss={onDismiss}
      />
    </Box>
  );
};

const SwapTransactions = () => (
  <Center px="4">
    <Box width="full">
      <PendingTxs />
      <FailedTxs />
    </Box>
  </Center>
);

export default SwapTransactions;
