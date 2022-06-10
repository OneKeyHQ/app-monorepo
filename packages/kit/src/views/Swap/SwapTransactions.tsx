import React, { FC, useCallback, useEffect } from 'react';

import axios from 'axios';
import { useIntl } from 'react-intl';

import { Alert, Box, Center } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import { setHaptics } from '../../hooks/setHaptics';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import {
  SerializableTransactionReceipt,
  TransactionDetails,
} from '../../store/reducers/swap';

import {
  useAllTransactions,
  useCleanFailedTransactions,
  useCleanFulfilledTransactions,
  useFinalizeTransaction,
} from './hooks/useTransactions';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

const PendingTx: FC<{ tx: TransactionDetails }> = ({ tx }) => {
  const { networkId, accountId } = useActiveWalletAccount();
  const finalizeTransaction = useFinalizeTransaction();
  const onQuery = useCallback(async () => {
    if (networkId) {
      const result = (await backgroundApiProxy.serviceNetwork.rpcCall(
        networkId,
        { method: 'eth_getTransactionReceipt', params: [tx.hash] },
      )) as SerializableTransactionReceipt | undefined;
      if (result) {
        finalizeTransaction(tx.hash, result);
        backgroundApiProxy.serviceToken.fetchTokenBalance(networkId, accountId);
      }
    }
  }, [tx, networkId, accountId, finalizeTransaction]);
  useEffect(() => {
    onQuery();
    const timer = setInterval(onQuery, 1000 * 5);
    return () => {
      clearInterval(timer);
    };
  }, [onQuery]);
  return <></>;
};

const PendingCrossTx: FC<{ tx: TransactionDetails }> = ({ tx }) => {
  const { networkId, accountId } = useActiveWalletAccount();
  const finalizeTransaction = useFinalizeTransaction();
  const onQuery = useCallback(async () => {
    if (tx.orderId) {
      const res = await axios.post(
        'https://www.swftc.info/api/v2/queryOrderState',
        {
          equipmentNo: tx.from,
          sourceType: 'H5',
          orderId: tx.orderId,
        },
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const data = res.data.data as { tradeState: string };
      if (data.tradeState === 'complete') {
        finalizeTransaction(tx.hash);
        backgroundApiProxy.serviceToken.fetchTokenBalance(networkId, accountId);
      }
    }
  }, [tx, networkId, accountId, finalizeTransaction]);
  useEffect(() => {
    onQuery();
    const timer = setInterval(onQuery, 1000 * 20);
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
    (tx) => !tx.confirmedTime,
  );
  const navigation = useNavigation<NavigationProps>();
  const onAction = useCallback(() => {
    setHaptics();
    navigation.navigate(HomeRoutes.TransactionHistoryScreen, {});
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
      {pendings.map((tx) =>
        tx.orderId ? (
          <PendingCrossTx key={tx.orderId} tx={tx} />
        ) : (
          <PendingTx key={tx.hash} tx={tx} />
        ),
      )}
    </Box>
  ) : null;
};

const FulfilledTransactions = () => {
  const intl = useIntl();
  const allTransactions = useAllTransactions();
  const cleanFulfilledTransaction = useCleanFulfilledTransactions();
  const confirmedTxs = Object.values(allTransactions).filter(
    (tx) =>
      (tx.receipt && Number(tx.receipt.status) === 1) ||
      (tx.orderId && tx.confirmedTime),
  );
  const navigation = useNavigation<NavigationProps>();
  const onAction = useCallback(() => {
    setHaptics();
    navigation.navigate(HomeRoutes.TransactionHistoryScreen, {});
    cleanFulfilledTransaction();
  }, [cleanFulfilledTransaction, navigation]);
  if (confirmedTxs.length === 0) {
    return <></>;
  }
  if (confirmedTxs.length === 1) {
    return (
      <Box mb="4">
        <Alert
          title={confirmedTxs[0].summary || ''}
          alertType="success"
          onDismiss={cleanFulfilledTransaction}
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
        onDismiss={cleanFulfilledTransaction}
        action={intl.formatMessage({ id: 'action__view' })}
        onAction={onAction}
      />
    </Box>
  );
};

const FailedTransactions = () => {
  const intl = useIntl();
  const allTransactions = useAllTransactions();
  const cleanFailedTransactions = useCleanFailedTransactions();
  const confirmedTxs = Object.values(allTransactions).filter(
    (tx) => tx.receipt && Number(tx.receipt.status) !== 1,
  );
  const navigation = useNavigation<NavigationProps>();
  const onAction = useCallback(() => {
    setHaptics();
    navigation.navigate(HomeRoutes.TransactionHistoryScreen, {});
    cleanFailedTransactions();
  }, [cleanFailedTransactions, navigation]);
  if (confirmedTxs.length === 0) {
    return <></>;
  }
  if (confirmedTxs.length === 1) {
    return (
      <Box mb="4">
        <Alert
          title={confirmedTxs[0].summary || ''}
          alertType="error"
          onDismiss={cleanFailedTransactions}
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
        onDismiss={cleanFailedTransactions}
        action={intl.formatMessage({ id: 'action__view' })}
        onAction={onAction}
      />
    </Box>
  );
};

const SwapTransactions = () => (
  <Center px="4">
    <Box maxW="420" width="full">
      <PendingTransactions />
      <FulfilledTransactions />
      <FailedTransactions />
    </Box>
  </Center>
);

export default SwapTransactions;
