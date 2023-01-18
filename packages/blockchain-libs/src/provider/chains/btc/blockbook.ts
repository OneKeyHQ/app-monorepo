import BigNumber from 'bignumber.js';

import { SimpleClient } from '@onekeyhq/engine/src/client/BaseClient';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
} from '@onekeyhq/engine/src/types/provider';
import { ResponseError } from '@onekeyhq/shared/src/errors/request-errors';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';

const MIN_SAT_PER_BYTE = 1;
// eslint-disable-next-line @typescript-eslint/naming-convention
const BTC_PER_KBYTES__TO__SAT_PER_BYTE = 10 ** 5;

class BlockBook extends SimpleClient {
  readonly restful: RestfulRequest;

  constructor(url: string) {
    super();
    this.restful = new RestfulRequest(url);
  }

  async getInfo(): Promise<ClientInfo> {
    const resp: any = await this.restful.get('/api/v2').then((i) => i.json());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const bestBlockNumber = Number(resp.backend.blocks);

    return {
      bestBlockNumber,
      isReady: Number.isFinite(bestBlockNumber) && bestBlockNumber > 0,
    };
  }

  getAccount(xpub: string, params: Record<string, any>): Promise<any> {
    return this.restful
      .get(`/api/v2/xpub/${xpub}`, params)
      .then((i) => i.json());
  }

  async getAddress(address: string): Promise<AddressInfo> {
    const resp: any = await this.restful
      .get(`/api/v2/address/${address}`, {
        details: 'basic',
      })
      .then((i) => i.json());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const unconfirmedBalance = Number(resp.unconfirmedBalance || 0);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      balance: new BigNumber(Number(resp.balance || 0) + unconfirmedBalance),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      existing: Number(resp.txs || 0) > 0,
    };
  }

  async estimateFee(waitingBlock: number): Promise<number> {
    const resp = await this.restful
      .get(`/api/v2/estimatefee/${waitingBlock}`)
      .then((i) => i.json())
      .catch((reason) => {
        console.debug('Error when estimating fee', reason);
        return { result: '0' };
      });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Number(resp.result || 0) * BTC_PER_KBYTES__TO__SAT_PER_BYTE;
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

  async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    try {
      const resp = await this.restful
        .get(`/api/v2/tx/${txid}`)
        .then((i) => i.json());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const confirmations = Number(resp.confirmations);
      return Number.isFinite(confirmations) && confirmations > 0
        ? TransactionStatus.CONFIRM_AND_SUCCESS
        : TransactionStatus.PENDING;
    } catch (e) {
      if (e instanceof ResponseError && e.response) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const error = (await e.response.json()) as { error?: string };
        if (error.error?.includes('not found')) {
          return TransactionStatus.NOT_FOUND;
        }
      }
      throw e;
    }
  }

  async getRawTransaction(txid: string): Promise<string> {
    const resp = await this.restful
      .get(`/api/v2/tx/${txid}`)
      .then((i) => i.json());

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
    return resp.hex;
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    try {
      const resp = await this.restful
        .get(`/api/v2/sendtx/${rawTx}`)
        .then((i) => i.json());

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
      return resp.result;
    } catch (e) {
      if (e instanceof ResponseError && e.response) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const error = await e.response.json();

        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          typeof error.error === 'string' &&
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
          error.error.includes('Transaction already in block chain')
        ) {
          throw new Error('Transaction already in block');
        }
      }

      throw e;
    }
  }
}

export { BlockBook };
