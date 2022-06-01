/* eslint-disable @typescript-eslint/no-unused-vars */
import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import type { IEncodedTx } from '../../types';

export default class VaultHelper extends VaultHelperBase {
  parseToNativeTx(encodedTx: IEncodedTx): Promise<any> {
    throw new NotImplemented();
  }

  parseToEncodedTx(rawTxOrEncodedTx: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  nativeTxToJson(nativeTx: any): Promise<string> {
    throw new NotImplemented();
  }

  jsonToNativeTx(json: string): Promise<any> {
    throw new NotImplemented();
  }
}
