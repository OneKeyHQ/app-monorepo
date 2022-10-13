/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import axios, { AxiosInstance } from 'axios';
import BigNumber from 'bignumber.js';

import type { ChainInfo, FeePricePerUnit, IBtcUTXO } from './types';

const MIN_SAT_PER_BYTE = 1;
const BTC_PER_KBYTES_TO_SAT_PER_BYTE = 10 ** 5;

class BlockBook {
  readonly request: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({});
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

  async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const [normalResp, fastResp, slowResp] = await Promise.all([
      this.estimateFee(5),
      this.estimateFee(1),
      this.estimateFee(20),
    ]);

    const isFulfilledFee = (fee: number) =>
      Number.isFinite(fee) && fee >= MIN_SAT_PER_BYTE;

    const normal: number = isFulfilledFee(normalResp)
      ? normalResp
      : MIN_SAT_PER_BYTE;

    const fast = isFulfilledFee(fastResp)
      ? fastResp
      : Math.max(MIN_SAT_PER_BYTE, normal * 1.6);

    const slow = isFulfilledFee(slowResp)
      ? slowResp
      : Math.max(MIN_SAT_PER_BYTE, normal * 0.6);

    return {
      normal: { price: new BigNumber(normal), waitingBlock: 5 },
      others: [
        { price: new BigNumber(slow), waitingBlock: 20 },
        { price: new BigNumber(fast), waitingBlock: 1 },
      ],
    };
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

  setChainInfo() {}
}

const getBlockBook = (chainInfo: ChainInfo) =>
  Promise.resolve(new BlockBook(chainInfo.clients[0].name));

export { BlockBook, getBlockBook };
