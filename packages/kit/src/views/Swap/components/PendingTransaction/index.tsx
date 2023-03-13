import type { FC } from 'react';
import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { updateTransaction } from '../../../../store/reducers/swapTransactions';
import { SwapQuoter } from '../../quoter';
import { isSimpleTx } from '../../utils';

import type { TransactionDetails } from '../../typings';

type PendingTransactionProps = {
  tx: TransactionDetails;
  stopInterval?: boolean;
};
const PendingTransaction: FC<PendingTransactionProps> = ({
  tx,
  stopInterval,
}) => {
  const onQuery = useCallback(async () => {
    const progressRes = await SwapQuoter.client.queryTransactionProgress(tx);
    if (progressRes) {
      const { status } = progressRes;
      if (status && status !== 'pending') {
        backgroundApiProxy.dispatch(
          updateTransaction({
            accountId: tx.accountId,
            networkId: tx.networkId,
            hash: tx.hash,
            transaction: {
              confirmedTime: Date.now(),
              status,
            },
          }),
        );
        if (tx.tokens) {
          const { from } = tx.tokens;
          const fromTokenIds = from.token.tokenIdOnNetwork
            ? [from.token.tokenIdOnNetwork]
            : [];
          backgroundApiProxy.serviceToken.getAccountTokenBalance({
            accountId: tx.accountId,
            networkId: from.networkId,
            tokenIds: fromTokenIds,
          });
          if (tx.receivingAddress) {
            const receivingAccount =
              await backgroundApiProxy.serviceAccount.getAccountByAddress({
                address: tx.receivingAddress,
              });
            const { to } = tx.tokens;
            if (receivingAccount) {
              const toTokenIds = to.token.tokenIdOnNetwork
                ? [to.token.tokenIdOnNetwork]
                : [];
              backgroundApiProxy.serviceToken.getAccountTokenBalance({
                accountId: receivingAccount.id,
                networkId: to.networkId,
                tokenIds: toTokenIds,
              });
            }
          }
        }
      }
      const { destinationTransactionHash } = progressRes;
      if (progressRes.destinationTransactionHash) {
        backgroundApiProxy.dispatch(
          updateTransaction({
            accountId: tx.accountId,
            networkId: tx.networkId,
            hash: tx.hash,
            transaction: {
              destinationTransactionHash:
                progressRes.destinationTransactionHash,
            },
          }),
        );
      }
      if (status === 'sucesss') {
        const txObj = { ...tx };
        txObj.destinationTransactionHash = destinationTransactionHash;
        const actualReceived = await SwapQuoter.client.getActualReceived(txObj);
        backgroundApiProxy.dispatch(
          updateTransaction({
            accountId: tx.accountId,
            networkId: tx.networkId,
            hash: tx.hash,
            transaction: {
              actualReceived,
            },
          }),
        );
        const completedTime = await SwapQuoter.client.getTxCompletedTime(tx);
        if (completedTime) {
          backgroundApiProxy.dispatch(
            updateTransaction({
              accountId: tx.accountId,
              networkId: tx.networkId,
              hash: tx.hash,
              transaction: { confirmedTime: Number(completedTime) },
            }),
          );
        }
        const networkFee = await SwapQuoter.client.getTxActualNetworkFee(tx);
        if (networkFee) {
          backgroundApiProxy.dispatch(
            updateTransaction({
              accountId: tx.accountId,
              networkId: tx.networkId,
              hash: tx.hash,
              transaction: { networkFee },
            }),
          );
        }
      }
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    onQuery();
    if (stopInterval) {
      return;
    }
    const ms = isSimpleTx(tx) ? 5 * 1000 : 20 * 1000;
    const timer = setInterval(onQuery, ms);
    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line
  }, []);
  return null;
};

export default PendingTransaction;
