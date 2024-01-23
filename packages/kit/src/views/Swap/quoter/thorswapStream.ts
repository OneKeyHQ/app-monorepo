import { QuoterType } from '../typings';

import { ThorSwapQuoter } from './thorswap';

import type {
  Quoter,
  TransactionDetails,
  TransactionProgress,
} from '../typings';

export class ThorSwapStreamQuoter implements Quoter {
  type: QuoterType = QuoterType.thorswapStream;

  client = new ThorSwapQuoter();

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    return this.client.queryTransactionProgress(tx);
  }
}
