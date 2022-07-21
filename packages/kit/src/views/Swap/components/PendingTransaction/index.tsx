import React, { FC, useCallback, useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { updateTransaction } from '../../../../store/reducers/swapTransactions';
import { SwapQuoter } from '../../quoter';
import { TransactionDetails } from '../../typings';

const PendingTransaction: FC<{ tx: TransactionDetails }> = ({ tx }) => {
  const onQuery = useCallback(async () => {
    const status = await SwapQuoter.client.queryTransactionStatus(tx);
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
      backgroundApiProxy.serviceToken.fetchTokenBalance({
        activeAccountId: tx.accountId,
        activeNetworkId: tx.networkId,
      });
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    onQuery();
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
