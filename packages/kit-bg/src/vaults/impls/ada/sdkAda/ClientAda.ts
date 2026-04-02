import Axios from 'axios';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { AxiosInstance } from 'axios';

export class ClientAda {
  public readonly axios: AxiosInstance;

  constructor({ url }: { url: string }) {
    this.axios = Axios.create({
      baseURL: url,
      timeout: timerUtils.getTimeDurationMs({ seconds: 30 }),
    });
  }

  async latestBlock() {
    const res = await this.axios
      .get<{ height: number }>('/blocks/latest')
      .then((i) => i.data);
    return {
      height: Number(res.height ?? 0),
    };
  }

  async submitTx({ data }: { data: string }) {
    let tx: Buffer | null = null;
    if (typeof data === 'string') {
      tx = Buffer.from(data, 'hex');
    } else {
      tx = Buffer.from(data);
    }

    return this.axios
      .post<{ data: any }>('/tx/submit', tx, {
        headers: {
          'Content-Type': 'application/cbor',
        },
      })
      .then((i) => i.data);
  }
}
