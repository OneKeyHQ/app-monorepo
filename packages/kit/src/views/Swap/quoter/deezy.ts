import axios from 'axios';

import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';

import type {
  Quoter,
  TransactionDetails,
  TransactionProgress,
} from '../typings';
import type { Axios } from 'axios';

export class DeezyQuoter implements Quoter {
  async getBaseUrl() {
    const baseUrl = await backgroundApiProxy.serviceSwap.getServerEndPoint();
    return `${baseUrl}/deezy`;
  }

  type: QuoterType = QuoterType.deezy;

  private client: Axios;

  constructor() {
    this.client = axios.create({ timeout: 60 * 1000 });
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    console.log('=====>>>>TX: ', tx);
    const isLnToBtcSwap = isLightningNetworkByNetworkId(tx.networkId);
    const baseUrl = await this.getBaseUrl();
    const params = {
      networkId: tx.networkId,
      [isLnToBtcSwap ? 'bolt11Invoice' : 'secretAccessKey']:
        tx.attachment?.swftcOrderId,
    };
    const response = await axios.get<{
      progress: TransactionProgress;
      on_chain_txid?: string;
    }>(`${baseUrl}${isLnToBtcSwap ? `/lookupLnToBtc` : '/lookupBtcToLn'}`, {
      params,
    });
    if (response.data && response.data.progress) {
      return {
        ...response.data.progress,
        status:
          // @ts-expect-error
          response.data?.progress?.status === 'success'
            ? 'sucesss'
            : response.data?.progress?.status,
      };
    }
    return {
      status: 'pending',
      destinationTransactionHash: isLnToBtcSwap
        ? response.data.on_chain_txid
        : '',
    };
  }
}
