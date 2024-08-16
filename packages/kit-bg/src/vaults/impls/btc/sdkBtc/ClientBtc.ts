/* eslint-disable spellcheck/spell-checker */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import axios from 'axios';

import { InvalidTransferValue } from '@onekeyhq/shared/src/errors';
import type { IRpcClientInfo } from '@onekeyhq/shared/types/customRpc';

import type { AxiosError, AxiosInstance } from 'axios';

type ISendTxRequestError = AxiosError<{ error: string }>;

class ClientBtc {
  readonly request: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: url,
      timeout: 30_000,
    });
  }

  async getInfo(): Promise<IRpcClientInfo> {
    const res = await this.request
      .get<{
        blockbook: {
          bestHeight: number;
          coin: string;
        };
      }>('/api/v2')
      .then((i) => i.data);
    const bestBlockNumber = Number(res.blockbook.bestHeight);
    return {
      bestBlockNumber,
      isReady: Number.isFinite(bestBlockNumber) && bestBlockNumber > 0,
      coin: res.blockbook.coin,
    };
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    try {
      let res: { result: string } | null = null;
      if (rawTx.length < 500) {
        res = await this.request
          .get(`/api/v2/sendtx/${rawTx}`)
          .then((i) => i.data);
      } else {
        res = await this.request
          .post(`/api/v2/sendtx/`, rawTx, {
            headers: {
              'Content-Type': 'text/plain',
            },
          })
          .then((i) => i.data);
      }

      return res?.result ?? '';
    } catch (e: unknown) {
      const err = e as ISendTxRequestError;
      if (err.response?.data?.error?.includes('-26: dust')) {
        throw new InvalidTransferValue();
      }

      if (
        err.response?.data?.error?.includes(
          'transaction already in block chain',
        )
      ) {
        throw new Error('Transaction already in block');
      }

      if (err.response?.data?.error) {
        console.log('blockbook send tx error: ', err.response?.data?.error);
        throw new Error(err.response?.data?.error);
      }
      throw err;
    }
  }
}

export { ClientBtc };
