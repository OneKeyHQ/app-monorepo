import type { FC } from 'react';
import { useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { archiveTransaction } from '../../../../store/reducers/staking';

import type { TransactionDetails } from '../../typing';

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
    const { addedTime } = this.tx;
    const base = 10 * 1000;
    const now = Date.now();
    const spent = now - addedTime;
    return spent <= 1000 * 60 * 60 ? base : 5 * 60 * 1000;
  }

  async queryTransactionProgress(tx: TransactionDetails) {
    const { networkId, accountId, nonce } = tx;
    if (nonce !== undefined) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce,
        });
      return { status };
    }
  }

  async runTask() {
    const { tx } = this;
    const progressRes = await this.queryTransactionProgress(tx);
    if (progressRes) {
      const { status } = progressRes;
      if (status && status !== 'pending') {
        this.stop();
        backgroundApiProxy.dispatch(
          archiveTransaction({
            accountId: tx.accountId,
            networkId: tx.networkId,
            txs: [tx.hash],
          }),
        );
        backgroundApiProxy.serviceStaking.fetchLidoOverview({
          accountId: tx.accountId,
          networkId: tx.networkId,
        });
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
