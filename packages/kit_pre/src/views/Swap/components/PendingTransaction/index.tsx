import type { FC } from 'react';
import { useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { updateTransaction } from '../../../../store/reducers/swapTransactions';
import { SwapQuoter } from '../../quoter';

import type { TransactionDetails } from '../../typings';

export class Scheduler {
  private timer?: ReturnType<typeof setTimeout>;

  public tx: TransactionDetails;

  constructor(tx: TransactionDetails) {
    this.tx = tx;
  }

  run() {
    this.runTask();
    const ms = this.getMs();
    if (ms) {
      this.timer = setTimeout(() => {
        this.run();
      }, ms);
    } else {
      this.stop();
    }
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private getMs() {
    const { addedTime, tokens } = this.tx;
    const base =
      tokens?.from.networkId === tokens?.to.networkId ? 5 * 1000 : 30 * 1000;
    const now = Date.now();
    const spent = now - addedTime;
    return spent <= 1000 * 60 * 60 ? base : 5 * 60 * 1000;
  }

  async runTask() {
    const { tx } = this;
    const progressRes = await SwapQuoter.client.queryTransactionProgress(tx);
    if (progressRes) {
      const { status } = progressRes;
      if (status && status !== 'pending') {
        this.stop();
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
          backgroundApiProxy.serviceToken.fetchAndSaveAccountTokenBalance({
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
              backgroundApiProxy.serviceToken.fetchAndSaveAccountTokenBalance({
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
  }
}

type PendingTransactionProps = {
  tx: TransactionDetails;
};
const PendingTransaction: FC<PendingTransactionProps> = ({ tx }) => {
  useEffect(() => {
    const scheduler = new Scheduler(tx);
    scheduler.run();
    return () => {
      scheduler.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

export default PendingTransaction;
