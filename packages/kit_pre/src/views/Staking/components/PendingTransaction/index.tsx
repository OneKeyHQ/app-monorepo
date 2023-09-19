import type { FC } from 'react';
import { useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  archiveKeleTransaction,
  archiveTransaction,
} from '../../../../store/reducers/staking';
import { StakingTypes, getTransactionStakingType } from '../../utils';

import type { Transaction, TransactionType } from '../../typing';

type SchedulerProps = {
  tx: Transaction;
  onFinish?: (params: { stop: () => void }) => void;
};

export class Scheduler {
  private timer?: ReturnType<typeof setTimeout>;

  public tx: Transaction;

  private onFinish?: (params: { stop: () => void }) => void;

  constructor(props: SchedulerProps) {
    this.tx = props.tx;
    this.onFinish = props.onFinish;
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
    const now = Date.now();
    const spent = now - addedTime;
    return spent <= 1000 * 60 * 60 ? 20 * 1000 : 5 * 60 * 1000;
  }

  async queryTransactionProgress(tx: Transaction) {
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
        this.onFinish?.({ stop: () => this.stop() });
      }
    }
  }
}

type PendingTransactionProps = {
  tx: Transaction;
};

export const PendingLidoTransaction: FC<PendingTransactionProps> = ({ tx }) => {
  useEffect(() => {
    const scheduler = new Scheduler({
      tx,
      onFinish: ({ stop }) => {
        stop();
        backgroundApiProxy.dispatch(
          archiveTransaction({
            accountId: tx.accountId,
            networkId: tx.networkId,
            txs: [tx.hash],
          }),
        );
        const type = tx.type as TransactionType;
        const stakeType = getTransactionStakingType(type);
        if (stakeType === StakingTypes.eth) {
          backgroundApiProxy.serviceStaking.fetchLidoOverview({
            accountId: tx.accountId,
            networkId: tx.networkId,
          });
        } else if (stakeType === StakingTypes.matic) {
          backgroundApiProxy.serviceStaking.fetchLidoMaticOverview({
            accountId: tx.accountId,
            networkId: tx.networkId,
          });
        }
      },
    });
    scheduler.run();
    return () => {
      scheduler.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

export const PendingKeleTransaction: FC<PendingTransactionProps> = ({ tx }) => {
  useEffect(() => {
    const scheduler = new Scheduler({
      tx,
      onFinish: async ({ stop }) => {
        const historys =
          await backgroundApiProxy.serviceStaking.fetchKeleOpHistory({
            networkId: tx.networkId,
            accountId: tx.accountId,
          });
        const item = historys?.find(
          (o) => o.transaction_id.toLowerCase() === tx.hash.toLowerCase(),
        );
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        if (item || now - tx.addedTime > day) {
          stop();
          backgroundApiProxy.dispatch(
            archiveKeleTransaction({
              accountId: tx.accountId,
              networkId: tx.networkId,
              txs: [tx.hash],
            }),
          );
          backgroundApiProxy.serviceStaking.fetchMinerOverview({
            networkId: tx.networkId,
            accountId: tx.accountId,
          });
        }
      },
    });
    scheduler.run();
    return () => {
      scheduler.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};
