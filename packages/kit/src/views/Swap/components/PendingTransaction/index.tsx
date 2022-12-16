import { FC, useCallback, useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { updateTransaction } from '../../../../store/reducers/swapTransactions';
import { SwapQuoter } from '../../quoter';
import { TransactionDetails } from '../../typings';

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
          backgroundApiProxy.serviceToken.fetchTokenBalance({
            activeAccountId: tx.accountId,
            activeNetworkId: from.networkId,
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
              backgroundApiProxy.serviceToken.fetchTokenBalance({
                activeAccountId: receivingAccount.id,
                activeNetworkId: to.networkId,
                tokenIds: toTokenIds,
              });
            }
          }
        }
      }
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
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    onQuery();
    if (stopInterval) {
      return;
    }
    const ms = tx.quoterType !== '0x' ? 20 * 1000 : 5 * 1000;
    const timer = setInterval(onQuery, ms);
    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line
  }, []);
  return <></>;
};

export default PendingTransaction;
