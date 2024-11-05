import Axios from 'axios';

import { OneKeyError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { AxiosInstance } from 'axios';

export class ClientTon {
  public readonly axios: AxiosInstance;

  constructor({ url }: { url: string }) {
    this.axios = Axios.create({
      baseURL: `${url}/api/v2`,
      timeout: timerUtils.getTimeDurationMs({ seconds: 30 }),
    });
  }

  async getMasterChainInfo(): Promise<{ blockHeight: number }> {
    const masterChainResponse = await this.axios.get<{
      result: {
        last: {
          seqno: number;
        };
      };
    }>('/getMasterchainInfo');
    const sequenceNumber = masterChainResponse.data?.result?.last?.seqno;
    if (typeof sequenceNumber !== 'number') {
      throw new OneKeyError('Invalid masterchain response');
    }
    return {
      blockHeight: sequenceNumber,
    };
  }

  async sendBocReturnHash({ boc }: { boc: string }): Promise<string> {
    const result = await this.axios.post<{ result: { hash: string } }>(
      '/sendBocReturnHash',
      {
        boc,
      },
    );

    const { hash } = result.data?.result ?? {};
    if (!hash) {
      throw new OneKeyError('Invalid hash');
    }
    const txId = this.convertHashToTxId(hash);
    return txId;
  }

  private convertHashToTxId(str: string) {
    const raw = Buffer.from(str, 'base64').toString('binary');
    let result = '';

    for (let i = 0; i < raw.length; i += 1) {
      const hex = raw.charCodeAt(i).toString(16);
      result += hex.length === 2 ? hex : `0${hex}`;
    }

    return result;
  }
}
