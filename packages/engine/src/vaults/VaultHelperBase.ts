import { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';

import { VaultContextBase } from './VaultContext';

import type { IDecodedTxAny, IEncodedTxAny } from '../types/vault';

// ATTENTION: VaultHelperBase can be init in UI, so it could NOT including engine, DB and any other background code
export abstract class VaultHelperBase extends VaultContextBase {
  // convert encodedTx to nativeTx (web3 sdk tx)
  abstract parseToNativeTx(encodedTx: IEncodedTxAny): Promise<IDecodedTxAny>;

  abstract parseToEncodedTx(
    rawTxOrEncodedTx: IEncodedTxAny,
  ): Promise<IEncodedTxAny>;

  abstract nativeTxToJson(nativeTx: IDecodedTxAny): Promise<string>;

  abstract jsonToNativeTx(json: string): Promise<IDecodedTxAny>;

  abstract createClientFromURL(url: string): BaseClient;

  async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = this.createClientFromURL(url);
    const start = performance.now();
    const latestBlock = (await client.getInfo()).bestBlockNumber;
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }
}
