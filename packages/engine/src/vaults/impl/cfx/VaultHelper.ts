import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import type { IEncodedTx } from '../../types';

export default class VaultHelper extends VaultHelperBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToNativeTx(_encodedTx: IEncodedTx): Promise<any> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToEncodedTx(rawTxOrEncodedTx: any): Promise<any> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nativeTxToJson(nativeTx: any): Promise<string> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  jsonToNativeTx(json: string): Promise<any> {
    throw new NotImplemented();
  }
}
