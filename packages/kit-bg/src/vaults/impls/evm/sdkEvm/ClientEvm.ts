import BigNumber from 'bignumber.js';

import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type { IRpcClientInfo } from '@onekeyhq/shared/types/customRpc';

export class ClientEvm extends JsonRPCRequest {
  async getInfo(): Promise<IRpcClientInfo> {
    const latestBlock: any = await this.call('eth_blockNumber');
    const bestBlockNumber = new BigNumber(latestBlock)?.toNumber();
    const isReady =
      !new BigNumber(bestBlockNumber).isNaN() && bestBlockNumber > 0;

    return { bestBlockNumber, isReady };
  }

  async getChainId(): Promise<{
    chainId: number;
  }> {
    const chainIdHex: any = await this.call('eth_chainId');
    const chainId = new BigNumber(chainIdHex)?.toNumber();
    return { chainId };
  }

  async checkEIP1559Support(): Promise<{
    isEIP1559FeeEnabled: boolean;
  }> {
    const hexBlock = await this.call<{
      baseFeePerGas: string;
    }>('eth_getBlockByNumber', ['latest', false]);
    const baseFeePerGas = new BigNumber(hexBlock.baseFeePerGas);
    const isEIP1559FeeEnabled = !(
      baseFeePerGas.isNaN() || baseFeePerGas.isEqualTo(0)
    ); // 0 also means not 1559
    return { isEIP1559FeeEnabled };
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    return this.call('eth_sendRawTransaction', [rawTx]);
  }
}
