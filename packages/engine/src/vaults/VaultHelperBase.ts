import { VaultContextBase } from './VaultContext';

import type { IDecodedTxAny, IEncodedTxAny } from '../types/vault';

// ATTENTION: VaultHelperBase can be init in UI, so it could NOT including engine, DB and any other background code
export abstract class VaultHelperBase extends VaultContextBase {
  // convert encodedTx to nativeTx (web3 sdk tx)
  abstract parseToNativeTx(encodedTx: IEncodedTxAny): Promise<IDecodedTxAny>;
}
