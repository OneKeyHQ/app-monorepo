/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import axios, { AxiosError, AxiosInstance } from 'axios';
import BigNumber from 'bignumber.js';

import { TransactionStatus } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import type {
  ChainInfo,
  IBtcUTXO,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

const BTC_PER_KBYTES_TO_SAT_PER_BYTE = 10 ** 5;

type RequestError = AxiosError<{ message: string }>;
type SendTxRequestError = AxiosError<{ error: string }>;

type ClientInfo = {
  bestBlockNumber: number;
  isReady: boolean;
};

class BlockBook {
  readonly request: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: url,
      timeout: 20000,
    });
  }

  async batchCall2SingleCall<T, R>(
    inputs: T[],
    handler: (input: T) => Promise<R | undefined>,
  ): Promise<Array<R | undefined>> {
    const ret = await Promise.all(
      inputs.map((input) =>
        handler(input).then(
          (value) => value,
          (reason) => {
            console.debug(
              `Error in Calling ${handler.name}. `,
              ' input: ',
              input,
              ', reason',
              reason,
            );
            return undefined;
          },
        ),
      ),
    );
    return ret;
  }

  setChainInfo() {}

  async getInfo(): Promise<ClientInfo> {
    const res = await this.request.get('/api/v2').then((i) => i.data);
    const bestBlockNumber = Number(res.backend.blocks);
    return {
      bestBlockNumber,
      isReady: Number.isFinite(bestBlockNumber) && bestBlockNumber > 0,
    };
  }

  async estimateFee(waitingBlock: number): Promise<number> {
    const resp = await this.request
      .get(`/api/v2/estimatefee/${waitingBlock}`)
      .then((res) => res.data)
      .catch((reason) => {
        console.debug('Error when estimating fee', reason);
        return { result: '0' };
      });

    return Number(resp.result || 0) * BTC_PER_KBYTES_TO_SAT_PER_BYTE;
  }

  getAccount(xpub: string, params: Record<string, any>): Promise<any> {
    return this.request
      .get(`/api/v2/xpub/${xpub}`, { params })
      .then((i: any) => i.data);
  }

  getBalance(address: string): Promise<BigNumber> {
    return this.request
      .get(`/api/v2/xpub/${address}`, {
        params: { details: 'basic' },
      })
      .then((response) => {
        const { data } = response;
        const balance = new BigNumber(data.balance);
        const unconfirmedBalance = new BigNumber(data.unconfirmedBalance);
        return !unconfirmedBalance.isNaN() && !unconfirmedBalance.isZero()
          ? balance.plus(unconfirmedBalance)
          : balance;
      });
  }

  getUTXOs(xpub: string) {
    return this.request
      .get(`/api/v2/utxo/${xpub}`)
      .then((res) => res.data as unknown as Array<IBtcUTXO>);
  }

  async getRawTransaction(txid: string): Promise<string> {
    const resp = await this.request
      .get(`/api/v2/tx/${txid}`)
      .then((i) => i.data);

    return resp.hex;
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
      const err = e as SendTxRequestError;
      if (
        err.response?.data?.error?.includes(
          'transaction already in block chain',
        )
      ) {
        throw new Error('Transaction already in block');
      }

      if (err.response?.data?.error) {
        debugLogger.sendTx.debug(
          'blockbook send tx error: ',
          err.response?.data?.error,
        );
        throw new Error(err.response?.data?.error);
      }
      throw err;
    }
  }

  getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    return this.batchCall2SingleCall(txids, (i) =>
      this.getTransactionStatus(i),
    );
  }

  async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    try {
      const resp = await this.request
        .get(`/api/v2/tx/${txid}`)
        .then((i) => i.data);
      const confirmations = Number(resp.confirmations);
      return Number.isFinite(confirmations) && confirmations > 0
        ? TransactionStatus.CONFIRM_AND_SUCCESS
        : TransactionStatus.PENDING;
    } catch (e) {
      const err = e as RequestError;
      if (err.response?.data?.message?.includes('not found')) {
        return TransactionStatus.NOT_FOUND;
      }

      throw e;
    }
  }
}

const getBlockBook = (chainInfo: ChainInfo) =>
  Promise.resolve(new BlockBook(chainInfo.clients?.[0].args?.[0]));

export { BlockBook, getBlockBook };
