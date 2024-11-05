import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

export class ClientScdo {
  readonly rpc: JsonRPCRequest;

  constructor({ url }: { url: string }) {
    this.rpc = new JsonRPCRequest(`${url}`);
  }

  async getBlockHeight(): Promise<{ blockHeight: number }> {
    const resp = await this.rpc.call<number>('scdo_getBlockHeight', []);
    return {
      blockHeight: resp,
    };
  }

  async broadcastTransaction(rawTx: string): Promise<boolean> {
    const result = await this.rpc.call<boolean>('scdo_addTx', [rawTx]);
    return result;
  }
}
