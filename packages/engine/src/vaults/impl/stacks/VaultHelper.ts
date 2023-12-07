import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import type { IEncodedTx } from '../../types';

export default class VaultHelper extends VaultHelperBase {
  parseToNativeTx(encodedTx: IEncodedTx): Promise<any> {
    return Promise.resolve(encodedTx);
  }

  parseToEncodedTx(rawTxOrEncodedTx: any): Promise<any> {
    return Promise.resolve(rawTxOrEncodedTx);
  }

  nativeTxToJson(): Promise<string> {
    throw new NotImplemented();
  }

  jsonToNativeTx(): Promise<any> {
    throw new NotImplemented();
  }
}
