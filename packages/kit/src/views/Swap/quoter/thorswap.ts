import axios from 'axios';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';

import type {
  Quoter,
  TransactionDetails,
  TransactionProgress,
} from '../typings';

export class ThorSwapQuoter implements Quoter {
  type: QuoterType = QuoterType.thorswap;

  async getBaseUrl() {
    const baseUrl = await backgroundApiProxy.serviceSwap.getServerEndPoint();
    return `${baseUrl}/thorswap`;
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { networkId, accountId, nonce, hash, attachment } = tx;
    if (nonce !== undefined) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce,
        });
      if (status === 'failed' || status === 'canceled') {
        return { status };
      }
    }
    if (hash && attachment?.thorswapQuoteId) {
      const data = await this.getTransactionInfo(tx);
      if (data && data.status === 'success') {
        const { legs } = data.result;
        const lastLegs = legs[legs.length - 1];
        return { status: 'sucesss', destinationTransactionHash: lastLegs.hash };
      }
      return { status: 'pending' };
    }
    if (Date.now() - tx.addedTime > 60 * 60 * 1000 * 24) {
      return { status: 'failed' };
    }
    return undefined;
  }

  async getTransactionInfo(tx: TransactionDetails) {
    const { hash, attachment } = tx;
    if (hash && attachment?.thorswapQuoteId) {
      const baseUrl = await this.getBaseUrl();
      const url = `${baseUrl}/transaction_status`;
      const res = await axios.get(url, {
        params: {
          hash,
          quoteId: attachment?.thorswapQuoteId,
        },
      });
      const data = res.data as {
        status: string;
        done: boolean;
        result: {
          quoteId: string;
          firstTransactionHash: string;
          status: string;
          isLending: boolean;
          isStreamingSwap: false;
          legs: {
            chain: string;
            hash: string;
            fromAsset: string;
            fromAmount: string;
            toAsset: string;
            toAmount: string;
          }[];
        };
      };
      return data;
    }
  }
}
