import axios from 'axios';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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
        return {
          status: 'sucesss',
          destinationTransactionHash: data.destinationTransactionHash,
        };
      }
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
      const url = `${baseUrl}/transaction_status_v2`;
      try {
        const res = await axios.get(url, {
          params: {
            hash,
            quoteId: attachment?.thorswapQuoteId,
          },
        });
        const data = res.data as {
          status: 'success' | 'failed' | 'pending';
          destinationTransactionHash?: string;
          actualReceived?: string;
        };
        return data;
      } catch (e) {
        debugLogger.common.info('thorswap getTransactionInfo error', e);
        return undefined;
      }
    }
  }
}
