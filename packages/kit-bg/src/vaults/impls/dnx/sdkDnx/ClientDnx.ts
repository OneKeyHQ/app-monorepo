import Axios from 'axios';

import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { AxiosInstance } from 'axios';

export class ClientDnx {
  public readonly axios: AxiosInstance;

  readonly rpc: JsonRPCRequest;

  constructor({ url }: { url: string }) {
    this.rpc = new JsonRPCRequest(`${url}/json_rpc`);
    this.axios = Axios.create({
      baseURL: url,
      timeout: timerUtils.getTimeDurationMs({ seconds: 30 }),
    });
  }

  async getBlockCount(): Promise<number> {
    const resp = await this.rpc.call<{ count: number }>('getblockcount', []);
    return resp.count;
  }

  async broadcastTransaction({ rawTx }: { rawTx: string }): Promise<string> {
    const resp = await this.axios.post<{ status: string }>(
      '/sendrawtransaction',
      {
        tx_as_hex: rawTx,
        do_not_relay: false,
      },
    );

    if (!resp.data.status || resp.data.status !== 'OK')
      throw new Error('Failed to send transaction');

    return resp.data.status;
  }
}
