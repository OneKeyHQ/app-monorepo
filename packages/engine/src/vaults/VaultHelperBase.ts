import { IEncodedTxAny } from '../types/vault';

import { VaultContextLite } from './VaultContext';

export abstract class VaultHelperBase extends VaultContextLite {
  // convert encodedTx to nativeTx (web3 sdk tx)
  abstract parseToNativeTx(encodedTx: IEncodedTxAny): Promise<any>;
}
