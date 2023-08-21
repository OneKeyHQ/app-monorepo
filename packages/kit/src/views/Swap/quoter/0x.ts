import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';

import type {
  Quoter,
  SerializableTransactionReceipt,
  TransactionDetails,
  TransactionProgress,
} from '../typings';

export class SimpleQuoter implements Quoter {
  type: QuoterType = QuoterType.zeroX;

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
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
    const result = (await backgroundApiProxy.serviceNetwork.rpcCall(networkId, {
      method: 'eth_getTransactionReceipt',
      params: [tx.hash],
    })) as SerializableTransactionReceipt | undefined;
    if (result) {
      return { status: Number(result.status) === 1 ? 'sucesss' : 'failed' };
    }

    if (Date.now() - tx.addedTime > 60 * 60 * 1000 * 24) {
      return { status: 'failed' };
    }
    return undefined;
  }
}
