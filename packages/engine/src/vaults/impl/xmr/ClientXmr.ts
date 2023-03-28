// eslint-disable-next-line @typescript-eslint/naming-convention
import LWSClient from '@mymonero/mymonero-lws-client';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import type { CoinInfo } from '@onekeyhq/engine/src/types/chain';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { NotImplemented } from '../../../errors';

import { getMoneroApi } from './sdk';

import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
  TransactionStatus,
} from '../../../types/provider';

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum RPC_METHODS {
  GET_HEIGHT = 'get_height',
  GET_FEE_ESTIMATE = 'get_fee_estimate',
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
    scanUrl,
    address,
    publicSpendKey,
    publicViewKey,
    privateSpendKey,
    privateViewKey,
  }: {
    rpcUrl: string;
    scanUrl: string;
    address: string;
    publicSpendKey: string;
    publicViewKey: string;
    privateSpendKey: string;
    privateViewKey: string;
  }) {
    super();
    const instance = axios.create({
      baseURL: scanUrl,
    });
    this.rpc = new JsonRPCRequest(`${rpcUrl}/json_rpc`);
    this.wallet = new LWSClient({ url: scanUrl, httpClient: instance });
    this.publicSpendKey = publicSpendKey;
    this.publicViewKey = publicViewKey;
    this.privateSpendKey = privateSpendKey;
    this.privateViewKey = privateViewKey;
    this.rpcUrl = rpcUrl;
    this.wallet.login(privateViewKey, address, true);
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

      const addressInfo = await this.getAddressInfo(request.address);

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

  async getAddressInfo(address: string) {
    const addressInfo = await this.wallet.getAddressInfo(
      this.privateViewKey,
      address,
    );

    return addressInfo;
  }

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

    const { transactions, blockchain_height: blockHeight } =
      await this.wallet.getAddressTxs(this.privateViewKey, address);

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

      if (
        blockHeight - tx.height >= 1 &&
        totalReceivedInTxBN.plus(totalSentInTxBN).isGreaterThan(0)
      ) {
        let amount = totalReceivedInTxBN.minus(totalSentInTxBN);

        if (amount.isNegative()) {
          amount = amount.plus(tx.fee ?? 0);
        }

        realTxs.push({
          ...tx,
          amount: amount.toFixed(),
        });
      }
    }

    return {
      txs: realTxs,
      blockHeight,
    };
  }

  async getUnspentBalance(address: string) {
    const moneroApi = await getMoneroApi();
    let unspentBN = new BigNumber(0);
    const resp = await this.wallet.unspentOutputs(this.privateViewKey, address);

    for (const output of resp.outputs) {
      const keyImage = await moneroApi.generateKeyImage({
        address,
        txPublicKey: output.tx_pub_key,
        privateViewKey: this.privateViewKey,
        privateSpendKey: this.privateSpendKey,
        publicSpendKey: this.publicSpendKey,
        outputIndex: String(output.index),
      });

      if (keyImage && !output.spend_key_images.includes(keyImage)) {
        unspentBN = unspentBN.plus(output.amount);
      }
    }
    return unspentBN;
  }

  broadcastTransaction(): Promise<string> {
    throw new NotImplemented();
  }

  getAddresses(): Promise<Array<AddressInfo | undefined>> {
    throw new NotImplemented();
  }

  getFeePricePerUnit(): Promise<FeePricePerUnit> {
    throw new NotImplemented();
  }

  getInfo(): Promise<ClientInfo> {
    throw new NotImplemented();
  }

  getTransactionStatuses(): Promise<Array<TransactionStatus | undefined>> {
    throw new NotImplemented();
  }
}
