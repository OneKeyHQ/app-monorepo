// eslint-disable-next-line @typescript-eslint/naming-convention
import LWSClient from '@mymonero/mymonero-lws-client';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import type { ChainInfo, CoinInfo } from '@onekeyhq/engine/src/types/chain';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { TransactionStatus } from '../../../types/provider';

import { getMoneroApi } from './sdk';

import type { MoneroKeys } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum RPC_METHODS {
  GET_HEIGHT = 'get_height',
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export enum PARAMS_ENCODINGS {
  BASE64 = 'base64',
  JSON_PARSED = 'jsonParsed',
}

export class ClientXmr extends BaseClient {
  readonly rpc: JsonRPCRequest;

  readonly wallet: LWSClient;

  readonly rpcUrl: string;

  readonly publicSpendKey: string;

  readonly publicViewKey: string;

  readonly privateSpendKey: string;

  readonly privateViewKey: string;

  constructor({
    rpcUrl,
    walletUrl,
    address,
    publicSpendKey,
    publicViewKey,
    privateSpendKey,
    privateViewKey,
  }: {
    rpcUrl: string;
    walletUrl: string;
    address: string;
    publicSpendKey: string;
    publicViewKey: string;
    privateSpendKey: string;
    privateViewKey: string;
  }) {
    super();
    const instance = axios.create({
      baseURL: walletUrl,
    });
    this.rpc = new JsonRPCRequest(`${rpcUrl}/json_rpc`);
    this.wallet = new LWSClient({ url: walletUrl, httpClient: instance });
    this.publicSpendKey = publicSpendKey;
    this.publicViewKey = publicViewKey;
    this.privateSpendKey = privateSpendKey;
    this.privateViewKey = privateViewKey;
    this.rpcUrl = rpcUrl;
    this.wallet.login(privateViewKey, address, true);
  }

  async broadcastTransaction(rawTx: string, options?: any): Promise<string> {
    return this.rpc.call(RPC_METHODS.SEND_TRANSACTION, [
      rawTx,
      { encoding: PARAMS_ENCODINGS.BASE64, ...(options || {}) },
    ]);
  }

  async getBalances(
    requests: Array<{
      address: string;
      coin: Partial<CoinInfo>;
    }>,
  ): Promise<(BigNumber | undefined)[]> {
    try {
      const [request] = requests;

      const moneroApi = await getMoneroApi();

      const addressInfo = await this.wallet.getAddressInfo(
        this.privateViewKey,
        request.address,
      );

      const spentOutputs = addressInfo.spent_outputs || [];

      let totalSentBN = new BigNumber(addressInfo.total_sent ?? 0);
      const totalReceivedBN = new BigNumber(addressInfo.total_received ?? 0);

      for (const spentOutput of spentOutputs) {
        const keyImage = await moneroApi.generateKeyImage({
          address: request.address,
          txPublicKey: spentOutput.tx_pub_key,
          privateViewKey: this.privateViewKey,
          privateSpendKey: this.privateSpendKey,
          publicSpendKey: this.publicSpendKey,
          outputIndex: String(spentOutput.out_index),
        });
        if (spentOutput.key_image !== keyImage) {
          totalSentBN = totalSentBN.minus(new BigNumber(spentOutput.amount));
        }
      }

      return [totalReceivedBN.minus(totalSentBN)];
    } catch (e) {
      console.log(e);
      return [];
    }
  }

  async getAccountInfo(
    address: string,
  ): Promise<{ [key: string]: any } | null> {}

  async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const [feePerSig] = await this.getFees();
    return {
      normal: {
        price: new BigNumber(feePerSig),
      },
    };
  }

  async getFees(): Promise<[number, string]> {
    const feeInfo: { [key: string]: any } = await this.rpc.call(
      RPC_METHODS.GET_FEES,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const feePerSig = feeInfo.value.feeCalculator.lamportsPerSignature;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const recentBlockhash = feeInfo.value.blockhash;
    return [feePerSig, recentBlockhash];
  }

  async getTransactionStatuses(
    txids: string[],
  ): Promise<Array<TransactionStatus | undefined>> {}

  async getCurrentHeight() {
    try {
      const resp = await axios.post<{ height: number }>(
        `${this.rpcUrl}/${RPC_METHODS.GET_HEIGHT}`,
      );
      return resp.data.height;
    } catch {
      return 0;
    }
  }

  async getHistory(address: string) {
    const moneroApi = await getMoneroApi();

    const realTxs = [];

    const { transactions } = await this.wallet.getAddressTxs(
      this.privateViewKey,
      address,
    );

    for (const tx of transactions) {
      const totalReceivedInTxBN = new BigNumber(tx.total_received ?? 0);
      let totalSentInTxBN = new BigNumber(tx.total_sent ?? 0);
      for (const spentOutput of tx.spent_outputs ?? []) {
        const keyImage = await moneroApi.generateKeyImage({
          address,
          txPublicKey: spentOutput.tx_pub_key,
          privateViewKey: this.privateViewKey,
          privateSpendKey: this.privateSpendKey,
          publicSpendKey: this.publicSpendKey,
          outputIndex: String(spentOutput.out_index),
        });

        if (keyImage !== spentOutput.key_image) {
          totalSentInTxBN = totalSentInTxBN.minus(spentOutput.amount);
        }
      }

      if (totalReceivedInTxBN.plus(totalSentInTxBN).isGreaterThan(0)) {
        realTxs.push({
          ...tx,
          amount: totalReceivedInTxBN.minus(totalSentInTxBN).toFixed(),
        });
      }
    }

    return realTxs;
  }
}
