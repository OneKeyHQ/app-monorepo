import { VaultContextBase } from './VaultContext';

import type { IEncodedTx, INativeTx, IRawTx } from './types';

// ATTENTION: VaultHelperBase can be init in UI, so it could NOT including engine, DB and any other background code
export abstract class VaultHelperBase extends VaultContextBase {
  // convert encodedTx to nativeTx (web3 sdk tx)
  abstract parseToNativeTx(encodedTx: IEncodedTx): Promise<INativeTx | null>;

  abstract parseToEncodedTx(
    rawTxOrEncodedTx: IRawTx | IEncodedTx,
  ): Promise<IEncodedTx | null>;

  abstract nativeTxToJson(nativeTx: INativeTx): Promise<string>;

  abstract jsonToNativeTx(json: string): Promise<INativeTx>;
}
