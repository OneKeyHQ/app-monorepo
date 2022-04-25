import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import type { IEncodedTxAny } from '../../../types/vault';

export default class VaultHelper extends VaultHelperBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToNativeTx(_encodedTx: IEncodedTxAny): Promise<any> {
    console.log('staticDecodeTx in CFX');
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToEncodedTx(rawTxOrEncodedTx: any): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
