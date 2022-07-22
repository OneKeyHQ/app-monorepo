import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Alert, Box, Center } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import { archiveTransaction } from '../../store/reducers/swapTransactions';

import PendingTransaction from './components/PendingTransaction';
import { useSummaryTx } from './hooks/useSwapUtils';
import { useTransactions } from './hooks/useTransactions';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

const ApprovePendingTransactions = () => {
  const { accountId, networkId } = useActiveWalletAccount();
  const allTransactions = useTransactions(accountId, networkId, 'approve');
  const pendings = allTransactions.filter((tx) => tx.status === 'pending');
  return (
    <>
      {pendings.map((tx) => (
        <PendingTransaction key={tx.hash} tx={tx} />
      ))}
    </>
  );
};

const PendingTransactions = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { accountId } = useActiveWalletAccount();
  const allTransactions = useTransactions(accountId);
  const pendings = allTransactions.filter((tx) => tx.status === 'pending');

  const onAction = useCallback(() => {
    navigation.navigate(HomeRoutes.SwapHistory);
  }, [navigation]);

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
        dismiss={false}
        actionType="right"
        alertType="info"
        action={intl.formatMessage({ id: 'action__view' })}
        onAction={onAction}
      />
      {pendings.map((tx) => (
        <PendingTransaction key={tx.hash} tx={tx} />
      ))}
    </Box>
  ) : null;
};

const FulfilledTransactions = () => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const summaryTx = useSummaryTx();
  const allTransactions = useTransactions(accountId);
  const confirmedTxs = allTransactions.filter(
    (tx) => tx.status === 'sucesss' && !tx.archive,
  );
  const navigation = useNavigation<NavigationProps>();
  const onAction = useCallback(() => {
    confirmedTxs.forEach((tx) => {
      backgroundApiProxy.dispatch(
        archiveTransaction({
          accountId: tx.accountId,
          networkId: tx.networkId,
          txs: [tx.hash],
        }),
      );
    });
    navigation.navigate(HomeRoutes.SwapHistory);
  }, [navigation, confirmedTxs]);
  if (confirmedTxs.length === 0) {
    return <></>;
  }
  if (confirmedTxs.length === 1) {
    return (
      <Box mb="4">
        <Alert
          title={summaryTx(confirmedTxs[0])}
          alertType="success"
          actionType="right"
          dismiss={false}
          action={intl.formatMessage({ id: 'action__view' })}
          onAction={onAction}
        />
      </Box>
    );
  }
  return (
    <Box mb="4" maxW="420" w="full">
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
        actionType="right"
        dismiss={false}
        action={intl.formatMessage({ id: 'action__view' })}
        onAction={onAction}
      />
    </Box>
  );
};

const FailedTransactions = () => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const summaryTx = useSummaryTx();
  const allTransactions = useTransactions(accountId);
  const confirmedTxs = allTransactions.filter(
    (tx) => tx.status === 'failed' && !tx.archive,
  );
  const navigation = useNavigation<NavigationProps>();
  const onAction = useCallback(() => {
    confirmedTxs.forEach((tx) => {
      backgroundApiProxy.dispatch(
        archiveTransaction({
          accountId: tx.accountId,
          networkId: tx.networkId,
          txs: [tx.hash],
        }),
      );
    });
    navigation.navigate(HomeRoutes.SwapHistory);
  }, [navigation, confirmedTxs]);
  if (confirmedTxs.length === 0) {
    return <></>;
  }
  if (confirmedTxs.length === 1) {
    return (
      <Box mb="4">
        <Alert
          title={summaryTx(confirmedTxs[0])}
          alertType="error"
          actionType="right"
          dismiss={false}
          action={intl.formatMessage({ id: 'action__view' })}
          onAction={onAction}
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
        alertType="error"
        actionType="right"
        dismiss={false}
        action={intl.formatMessage({ id: 'action__view' })}
        onAction={onAction}
      />
    </Box>
  );
};

const SwapTransactions = () => (
  <Center px="4">
    <Box maxW="420" width="full">
      <ApprovePendingTransactions />
      <PendingTransactions />
      <FulfilledTransactions />
      <FailedTransactions />
    </Box>
  </Center>
);

export default SwapTransactions;
