import BigNumber from 'bignumber.js';

import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type { IEvmClientInfo } from '@onekeyhq/shared/types/customRpc';

export class ClientEvm {
  readonly rpc: JsonRPCRequest;

  constructor(url: string) {
    this.rpc = new JsonRPCRequest(url);
  }

  async getInfo(): Promise<IEvmClientInfo> {
    const latestBlock: any = await this.rpc.call('eth_blockNumber');
    const bestBlockNumber = new BigNumber(latestBlock)?.toNumber();
    const isReady =
      !new BigNumber(bestBlockNumber).isNaN() && bestBlockNumber > 0;

    return { bestBlockNumber, isReady };
  }
}
