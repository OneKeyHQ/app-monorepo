import Axios from 'axios';

import { OneKeyError, OneKeyInternalError } from '@onekeyhq/engine/src/errors';

import type {
  AccountInfo,
  BlockHeader,
  BroadcastTransactionResponse,
  Coin,
  CosmosNodeInfo,
  GasInfo,
  TransactionResponseInfo,
} from './type';
import type { AxiosError, AxiosInstance } from 'axios';

export declare enum BroadcastMode {
  /** BROADCAST_MODE_UNSPECIFIED - zero-value for mode ordering */
  BROADCAST_MODE_UNSPECIFIED = 0,
  /**
   * BROADCAST_MODE_BLOCK - BROADCAST_MODE_BLOCK defines a tx broadcasting mode where the client waits for
   * the tx to be committed in a block.
   */
  BROADCAST_MODE_BLOCK = 1,
  /**
   * BROADCAST_MODE_SYNC - BROADCAST_MODE_SYNC defines a tx broadcasting mode where the client waits for
   * a CheckTx execution response only.
   */
  BROADCAST_MODE_SYNC = 2,
  /**
   * BROADCAST_MODE_ASYNC - BROADCAST_MODE_ASYNC defines a tx broadcasting mode where the client returns
   * immediately.
   */
  BROADCAST_MODE_ASYNC = 3,
  UNRECOGNIZED = -1,
}

export class CosmosNodeClient {
  public readonly axios: AxiosInstance;

  constructor(baseURL: string) {
    this.axios = Axios.create({
      baseURL: baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL,
      timeout: 30 * 1000,
    });
  }

  public async fetchNodeInfo(): Promise<CosmosNodeInfo> {
    const response = await this.axios.get<{ node_info: CosmosNodeInfo }>(
      `/node_info`,
    );
    return response.data.node_info;
  }

  public async fetchBlockHeader(): Promise<BlockHeader> {
    const response = await this.axios.get<{ block: { header: BlockHeader } }>(
      `/blocks/latest`,
    );
    return response.data.block.header;
  }

  public async fetchBlockHeaderV1beta1(): Promise<BlockHeader> {
    const response = await this.axios.get<{ block: { header: BlockHeader } }>(
      `/cosmos/base/tendermint/v1beta1/blocks/latest`,
    );
    return response.data.block.header;
  }

  public async getAccountInfo(address: string): Promise<AccountInfo | null> {
    const response = await this.axios.get<{ account: AccountInfo }>(
      `/cosmos/auth/v1beta1/accounts/${address}`,
    );

    if (response.status === 404) {
      return null;
    }

    return response.data.account;
  }

  public async getAccountBalances(address: string): Promise<Coin[]> {
    const response = await this.axios.get<{ balances: Coin[] }>(
      `/cosmos/bank/v1beta1/balances/${address}`,
    );

    return response.data.balances ?? [];
  }

  async getTransactionInfo(txid: string): Promise<TransactionResponseInfo> {
    return this.axios
      .get<{ tx_response: TransactionResponseInfo }>(
        `/cosmos/tx/v1beta1/txs/${txid}`,
      )
      .then((res) => res.data.tx_response)
      .catch((err: AxiosError) => {
        throw new OneKeyError(err.response?.status.toString());
      });
  }

  async broadcastTransaction(rawTx: string): Promise<string | null> {
    const data = {
      mode: 'BROADCAST_MODE_SYNC',
      tx_bytes: rawTx,
    };
    const resp = await this.axios.post<{
      tx_response: BroadcastTransactionResponse;
    }>('/cosmos/tx/v1beta1/txs', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const rawLog = resp.data.tx_response.raw_log;
    const { code } = resp.data.tx_response;

    if (code != null && code !== 0) {
      if (rawLog.indexOf('account sequence mismatch') !== -1) {
        throw new OneKeyInternalError(
          rawLog,
          'msg__broadcast_tx_sequence_number_error',
        );
      }
      if (rawLog.indexOf('insufficient fees') !== -1) {
        throw new OneKeyInternalError(
          rawLog,
          'msg__broadcast_tx_Insufficient_fee',
        );
      }
      throw new OneKeyInternalError(rawLog);
    }

    return resp.data.tx_response?.txhash ?? null;
  }

  async simulationTransaction(tx: any): Promise<GasInfo | null> {
    const resp = await this.axios.post<{ gas_info: GasInfo }>(
      '/cosmos/tx/v1beta1/simulate',
      tx,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return resp.data.gas_info ?? null;
  }
}
