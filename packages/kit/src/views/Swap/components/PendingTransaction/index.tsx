import React, { FC, useCallback, useEffect } from 'react';

import axios from 'axios';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../../hooks';
import { updateTransaction } from '../../../../store/reducers/swapTransactions';
import {
  SerializableTransactionReceipt,
  SwftcTransactionReceipt,
  TransactionDetails,
} from '../../typings';

const PendingTx: FC<{ tx: TransactionDetails }> = ({ tx }) => {
  const { networkId, accountId } = useActiveWalletAccount();
  const onQuery = useCallback(async () => {
    if (tx.nonce) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce: tx.nonce,
        });
      if (status !== 'pending') {
        backgroundApiProxy.dispatch(
          updateTransaction({
            accountId,
            networkId,
            hash: tx.hash,
            transaction: {
              confirmedTime: Date.now(),
              status,
            },
          }),
        );
        backgroundApiProxy.serviceToken.fetchTokenBalance({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
      }
    } else {
      const result = (await backgroundApiProxy.serviceNetwork.rpcCall(
        networkId,
        {
          method: 'eth_getTransactionReceipt',
          params: [tx.hash],
        },
      )) as SerializableTransactionReceipt | undefined;
      if (result) {
        const status = Number(result.status) === 1 ? 'sucesss' : 'failed';
        backgroundApiProxy.dispatch(
          updateTransaction({
            accountId,
            networkId,
            hash: tx.hash,
            transaction: { status, receipt: result, confirmedTime: Date.now() },
          }),
        );
        backgroundApiProxy.serviceToken.fetchTokenBalance({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
      }
    }
  }, [tx, networkId, accountId]);

  useEffect(() => {
    onQuery();
    const timer = setInterval(onQuery, 1000 * 5);
    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line
  }, []);
  return <></>;
};

const SwftcPendingTx: FC<{ tx: TransactionDetails }> = ({ tx }) => {
  const { networkId, accountId } = useActiveWalletAccount();
  const onQuery = useCallback(async () => {
    if (tx.thirdPartyOrderId) {
      const res = await axios.post(
        'https://www.swftc.info/api/v2/queryOrderState',
        {
          equipmentNo: tx.from,
          sourceType: 'H5',
          orderId: tx.thirdPartyOrderId,
        },
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const data = res.data.data as SwftcTransactionReceipt;
      if (data) {
        if (data.tradeState === 'complete') {
          backgroundApiProxy.dispatch(
            updateTransaction({
              accountId,
              networkId,
              hash: tx.hash,
              transaction: {
                status: 'sucesss',
                swftcReceipt: data,
                confirmedTime: Date.now(),
              },
            }),
          );
          backgroundApiProxy.serviceToken.fetchTokenBalance({
            activeAccountId: accountId,
            activeNetworkId: networkId,
            tokenIds: [],
          });
        } else if (data.tradeState !== tx?.swftcReceipt?.tradeState) {
          console.log('data.tradeState', data.tradeState);
          backgroundApiProxy.dispatch(
            updateTransaction({
              accountId,
              networkId,
              hash: tx.hash,
              transaction: {
                status: 'pending',
                swftcReceipt: data,
              },
            }),
          );
        } else if (Date.now() - tx.addedTime > 60 * 60 * 1000) {
          backgroundApiProxy.dispatch(
            updateTransaction({
              accountId,
              networkId,
              hash: tx.hash,
              transaction: {
                status: 'failed',
                swftcReceipt: data,
                confirmedTime: Date.now(),
              },
            }),
          );
        }
        if (tx.nonce) {
          const status =
            await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus(
              { networkId, accountId, nonce: tx.nonce },
            );
          if (status === 'canceled') {
            backgroundApiProxy.dispatch(
              updateTransaction({
                networkId,
                accountId,
                hash: tx.hash,
                transaction: {
                  status: 'canceled',
                  confirmedTime: Date.now(),
                },
              }),
            );
          }
        }
      }
    }
  }, [tx, networkId, accountId]);
  useEffect(() => {
    onQuery();
    const timer = setInterval(onQuery, 1000 * 20);
    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line
  }, []);
  return <></>;
};

const PendingTransaction: FC<{ tx: TransactionDetails }> = ({ tx }) =>
  tx.thirdPartyOrderId ? <SwftcPendingTx tx={tx} /> : <PendingTx tx={tx} />;

export default PendingTransaction;
