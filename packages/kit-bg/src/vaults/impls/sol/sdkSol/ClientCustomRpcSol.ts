import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type { IRpcClientInfo } from '@onekeyhq/shared/types/customRpc';

import { EParamsEncodings, ERpcMethods } from './ClientSol';

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

  async broadcastTransaction(
    rawTx: string,
    options?: {
      skipPreflight?: boolean;
      preflightCommitment?: string;
      maxRetries?: number;
    },
  ): Promise<string> {
    return this.rpc.call(ERpcMethods.SEND_TRANSACTION, [
      rawTx,
      {
        encoding: EParamsEncodings.BASE64,
        // Match the server proxy. The Solana default `finalized` bank lags
        // the tip by ~30 slots, so a nearly expired blockhash could pass
        // preflight there and then be dropped at the tip, leaving a txid
        // that never lands.
        preflightCommitment: 'confirmed',
        ...options,
      },
    ]);
  }
}

export { ClientCustomRpcSol };
