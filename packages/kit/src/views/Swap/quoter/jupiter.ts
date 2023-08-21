import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';

import type {
  Quoter,
  TransactionDetails,
  TransactionProgress,
} from '../typings';

export class JupiterQuoter implements Quoter {
  type: QuoterType = QuoterType.jupiter;

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { networkId, accountId, hash } = tx;
    const status =
      await backgroundApiProxy.serviceHistory.queryTransactionByTxid({
        networkId,
        accountId,
        txid: hash,
      });
    return { status };
  }
}
