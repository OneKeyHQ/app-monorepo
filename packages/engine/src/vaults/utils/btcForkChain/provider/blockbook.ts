/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import axios from 'axios';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { TransactionStatus } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import type {
  ChainInfo,
  IBtcUTXO,
  IBtcUTXOInfo,
  ICollectUTXOsOptions,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { TransferValueTooSmall } from '../../../../errors';

import type { AxiosError, AxiosInstance } from 'axios';

const BTC_PER_KBYTES_TO_SAT_PER_BYTE = 10 ** 5;

type RequestError = AxiosError<{ message: string }>;
type SendTxRequestError = AxiosError<{ error: string }>;

type ClientInfo = {
  bestBlockNumber: number;
  isReady: boolean;
};

class BlockBook {
  readonly request: AxiosInstance;

  readonly backendRequest: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: url,
      timeout: 20000,
    });

    this.backendRequest = axios.create({
      baseURL: `${getFiatEndpoint()}/book`,
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

  getAccountWithAddress(
    address: string,
    params: Record<string, any>,
  ): Promise<any> {
    return this.request
      .get(`/api/v2/address/${address}`, { params })
      .then((i: any) => i.data);
  }

  getBalance(xpub: string): Promise<BigNumber> {
    return this.request
      .get(`/api/v2/xpub/${xpub}`, {
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

  getBalanceWithAddress(address: string): Promise<BigNumber> {
    return this.request
      .get(`/api/v2/address/${address}`, {
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

  async getUTXOs(
    xpub: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: ICollectUTXOsOptions = {},
  ): Promise<IBtcUTXOInfo> {
    const utxos = await this.request
      .get(`/api/v2/utxo/${xpub}`)
      .then((res) => res.data as unknown as Array<IBtcUTXO>);
    return {
      utxos,
    };
  }

  async getUTXOsFromBackendApi({
    xpub,
    impl,
    options,
    networkId,
  }: {
    xpub: string;
    impl: string;
    options: ICollectUTXOsOptions;
    networkId: string;
  }): Promise<IBtcUTXOInfo> {
    const res = await this.backendRequest.post<IBtcUTXOInfo>(
      `/${impl}/api/v2/utxo_info/`,
      {
        xpub,
        forceSelectUtxos: options.forceSelectUtxos,
        // return utxo without inscriptions
        checkInscription: isNil(options.checkInscription)
          ? true
          : options.checkInscription,
        customAddressMap: options.customAddressMap,
        networkId,
      },
    );
    return res.data;
  }

  async getRawTransaction(txid: string): Promise<string> {
    const resp = await this.request
      .get(`/api/v2/tx/${txid}`)
      .then((i) => i.data);

    return resp.hex;
  }

  async getTransactionDetail(txId: string): Promise<any> {
    const resp = await this.request
      .get(`/api/v2/tx/${txId}`)
      .then((i) => i.data);

    return resp;
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
      if (err.response?.data?.error?.includes('-26: dust')) {
        throw new TransferValueTooSmall();
      }

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

  async getHistory(
    network: string,
    networkId: string,
    address: string,
    xpub: string,
    symbol: string,
    decimals: number,
  ): Promise<any> {
    return this.backendRequest
      .post('/history', {
        network,
        networkId,
        address,
        xpub: xpub || undefined,
        symbol,
        decimals,
      })
      .then((i) => i.data);
  }
}

function getRpcUrlFromChainInfo(chainInfo: ChainInfo | undefined) {
  return chainInfo?.clients?.[0].args?.[0];
}

const getBlockBook = (chainInfo: ChainInfo) =>
  Promise.resolve(new BlockBook(getRpcUrlFromChainInfo(chainInfo)));

export { BlockBook, getBlockBook, getRpcUrlFromChainInfo };
