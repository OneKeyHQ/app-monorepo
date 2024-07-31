import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type { IRpcClientInfo } from '@onekeyhq/shared/types/customRpc';

import { ERpcMethods } from './ClientSol';

class ClientCustomRpcSol {
  readonly rpc: JsonRPCRequest;

  constructor(url: string) {
    this.rpc = new JsonRPCRequest(url);
  }

  async getInfo(): Promise<IRpcClientInfo> {
    // @ts-ignore
    const [epochInfo, ok] = await this.rpc.batchCall([
      [ERpcMethods.GET_EPOCH_INFO, []],
      [ERpcMethods.GET_HEALTH, []],
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const slot = epochInfo.absoluteSlot;
    const isReady = ok === 'ok';
    return {
      bestBlockNumber: slot,
      isReady,
    };
  }
}

export { ClientCustomRpcSol };
