import axios from 'axios';

import { getNetworkImpl } from '@onekeyhq/engine/src/managers/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';

import type {
  Quoter,
  SwftcTransactionReceipt,
  TransactionDetails,
  TransactionProgress,
} from '../typings';
import type { Axios } from 'axios';

export class SwftcQuoter implements Quoter {
  async getBaseUrl() {
    const baseUrl = await backgroundApiProxy.serviceSwap.getServerEndPoint();
    return `${baseUrl}/swft`;
  }

  type: QuoterType = QuoterType.swftc;

  private client: Axios;

  constructor() {
    this.client = axios.create({ timeout: 60 * 1000 });
  }

  async modifyTxId(orderId: string, depositTxid: string) {
    const baseURL = await this.getBaseUrl();
    const url = `${baseURL}/modifyTxId`;
    const res = await this.client.post(url, { orderId, depositTxid });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const result = res.data.data as string;
    return result;
  }

  async getTxOrderInfo(tx: TransactionDetails) {
    const swftcOrderId = tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;
    if (swftcOrderId) {
      const baseUrl = await this.getBaseUrl();
      const url = `${baseUrl}/queryOrderState`;
      const res = await axios.post(url, {
        equipmentNo: tx.from,
        sourceType: 'H5',
        orderId: swftcOrderId,
      });
      // eslint-disable-next-line
      const receipt = res.data.data as SwftcTransactionReceipt;
      return receipt;
    }
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const swftcOrderId = tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;
    if (swftcOrderId) {
      const baseUrl = await this.getBaseUrl();
      const url = `${baseUrl}/queryOrderState`;
      const res = await axios.post(url, {
        equipmentNo: tx.from,
        sourceType: 'H5',
        orderId: swftcOrderId,
      });
      // eslint-disable-next-line
      const receipt = res.data.data as SwftcTransactionReceipt;
      if (receipt.tradeState === 'complete') {
        return {
          status: 'sucesss',
          destinationTransactionHash: receipt.transactionId,
        };
      }
      if (receipt.tradeState === 'refund_complete') {
        return { status: 'failed' };
      }
      if (receipt.transactionId) {
        return { destinationTransactionHash: receipt.transactionId };
      }
    }
    const { networkId, accountId, nonce, hash } = tx;
    if (getNetworkImpl(networkId) === 'evm' && nonce !== undefined) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce,
        });
      if (status === 'canceled' || status === 'failed') {
        return { status };
      }
    } else if (getNetworkImpl(networkId) !== 'evm') {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionByTxid({
          networkId,
          accountId,
          txid: hash,
        });
      if (status === 'canceled' || status === 'failed') {
        return { status };
      }
    }

    if (Date.now() - tx.addedTime > 60 * 60 * 1000 * 24) {
      return { status: 'failed' };
    }

    return undefined;
  }
}
