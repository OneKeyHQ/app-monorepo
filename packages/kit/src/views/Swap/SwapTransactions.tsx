import React, { FC, useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import { TransactionDetails } from '../../store/reducers/swap';

import {
  useAllTransactions,
  useCleanAllConfirmedTransaction,
  useFinalizeTransaction,
} from './hooks/useTransactions';

const PendingTx: FC<{ tx: TransactionDetails }> = ({ tx }) => {
  const { networkId } = useActiveWalletAccount();
  const finalizeTransaction = useFinalizeTransaction();
  const onQuery = useCallback(async () => {
    if (networkId) {
      const result = await backgroundApiProxy.serviceNetwork.rpcCall(
        networkId,
        { method: 'eth_getTransactionReceipt', params: [tx.hash] },
      );
      if (result) {
        finalizeTransaction(tx.hash);
      }
    }
  }, [tx, networkId, finalizeTransaction]);
  useEffect(() => {
    const timer = setInterval(onQuery, 1000 * 5);
    return () => {
      clearInterval(timer);
    };
  }, [onQuery]);
  return <></>;
};

const PendingTransactions = () => {
  const intl = useIntl();
  const allTransactions = useAllTransactions();
  const pendings = Object.values(allTransactions).filter(
    (tx) => !tx.approval && !tx.confirmedTime,
  );
  return pendings.length ? (
    <Box mb="4">
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__str_transactions_in_progress',
          },
          {
            'content__str_transactions_in_progress': pendings.length,
          },
        )}
        alertType="info"
      />
      {pendings.map((tx) => (
        <PendingTx tx={tx} />
      ))}
    </Box>
  ) : null;
};

const ConfirmedTransactions = () => {
  const intl = useIntl();
  const allTransactions = useAllTransactions();
  const cleanAllConfirmedTransaction = useCleanAllConfirmedTransaction();
  const confirmedTxs = Object.values(allTransactions).filter(
    (tx) => !tx.approval && tx.confirmedTime,
  );
  if (confirmedTxs.length === 0) {
    return <></>;
  }
  if (confirmedTxs.length === 1) {
    return (
      <Box mb="4">
        <Alert
          title={confirmedTxs[0].summary || ''}
          alertType="success"
          onDismiss={cleanAllConfirmedTransaction}
        />
      </Box>
    );
  }
  return (
    <Box mb="4">
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__str_transactions_succeeded',
          },
          {
            'content__str_transactions_succeeded': confirmedTxs.length,
          },
        )}
        alertType="success"
        onDismiss={cleanAllConfirmedTransaction}
      />
    </Box>
  );
};

const SwapTransactions = () => (
  <Box px="4">
    <PendingTransactions />
    <ConfirmedTransactions />
  </Box>
);

export default SwapTransactions;
