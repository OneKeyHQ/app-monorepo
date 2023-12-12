import Axios from 'axios';
import { get } from 'lodash';

import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { submitTransactionFromString } from './transaction';

import type { GetTransactionResponse, UTXOResponse } from './types';
import type { AxiosError, AxiosInstance } from 'axios';

// https://api.kaspa.org/docs
export class RestAPIClient {
  private readonly axios: AxiosInstance;

  constructor(url: string) {
    this.axios = Axios.create({
      baseURL: url,
      timeout: 30 * 1000,
    });
  }

  async getBlockdag() {
    try {
      const resp = await this.axios.get<{
        networkName: string;
        blockCount: string;
        headerCount: string;
        virtualDaaScore: string;
      }>('/info/blockdag', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return resp.data;
    } catch (error) {
      return {
        networkName: '',
        blockCount: '0',
        headerCount: '0',
        virtualDaaScore: '0',
      };
    }
  }

  async getNetworkInfo() {
    try {
      const resp = await this.axios.get<{
        networkName: string;
        blockCount: string;
        headerCount: string;
        virtualDaaScore: string;
      }>('/info/network', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return resp.data;
    } catch (error) {
      return {
        networkName: '',
        blockCount: '0',
        headerCount: '0',
        virtualDaaScore: '0',
      };
    }
  }

  async queryBalance(address: string): Promise<bigint> {
    try {
      const resp = await this.axios.get<{ address: string; balance: bigint }>(
        `/addresses/${address}/balance`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return resp.data.balance;
    } catch (error) {
      return 0n;
    }
  }

  async queryUtxos(address: string): Promise<UTXOResponse[]> {
    try {
      const resp = await this.axios.get<UTXOResponse[]>(
        `/addresses/${address}/utxos`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return resp.data;
    } catch (error) {
      return [];
    }
  }

  async sendRawTransaction(rawTx: string): Promise<string> {
    const transaction = submitTransactionFromString(rawTx);
    return this.axios
      .post<{
        transactionId: string;
        error?: string;
      }>(`/transactions`, transaction, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then((resp) => {
        try {
          debugLogger.sendTx.debug(
            'sendRawTransaction kaspa:',
            resp.data?.transactionId ?? 'transactionId:undefined',
            resp.data?.error ?? 'error:undefined',
          );
        } catch (e) {
          // ignore
        }
        return resp.data.transactionId;
      })
      .catch((error: AxiosError) => {
        const message: string = get(error, 'response.data.error', '');

        if (message.match(/payment of \d+ is dust/)) {
          throw new OneKeyInternalError(message, 'msg__amount_too_small');
        }

        if (message.toLowerCase().indexOf('insufficient balance') !== -1) {
          throw new OneKeyInternalError(
            message,
            'msg__broadcast_dot_tx_Insufficient_fee',
          );
        }

        if (
          message
            .toLowerCase()
            .indexOf('is larger than max allowed size of 100000') !== -1
        ) {
          throw new OneKeyInternalError(
            message,
            'msg__broadcast_kaspa_tx_max_allowed_size',
          );
        }

        throw new OneKeyInternalError(message);
      });
  }

  async getTransaction(transactionId: string): Promise<GetTransactionResponse> {
    const resp = await this.axios.get<GetTransactionResponse>(
      `/transactions/${transactionId}?inputs=true&outputs=true&resolve_previous_outpoints=light`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return resp.data;
  }

  async getTransactions(txIds: string[]): Promise<GetTransactionResponse[]> {
    const resp = await this.axios.post<GetTransactionResponse[]>(
      `/transactions/search?resolve_previous_outpoints=light`,
      {
        transactionIds: [...txIds],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return resp.data;
  }

  async getTransactionsByAddress(
    address: string,
  ): Promise<GetTransactionResponse[]> {
    const resp = await this.axios.get<GetTransactionResponse[]>(
      `/addresses/${address}/full-transactions?limit=50&offset=0&resolve_previous_outpoints=light`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return resp.data;
  }
}
