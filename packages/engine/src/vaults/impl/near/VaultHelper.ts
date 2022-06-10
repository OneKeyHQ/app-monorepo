import { NotImplemented } from '../../../errors';
import { IEncodedTx, INativeTx, IRawTx } from '../../types';
import { VaultHelperBase } from '../../VaultHelperBase';

import { IEncodedTxNear, INativeTxNear } from './types';
import { deserializeTransaction } from './utils';

export default class VaultHelper extends VaultHelperBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToNativeTx(encodedTx: IEncodedTxNear): Promise<INativeTxNear | null> {
    if (!encodedTx) {
      return Promise.resolve(null);
    }
    return Promise.resolve(deserializeTransaction(encodedTx));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToEncodedTx(
    rawTxOrEncodedTx: IRawTx | IEncodedTx,
  ): Promise<IEncodedTx | null> {
    return Promise.resolve(rawTxOrEncodedTx);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nativeTxToJson(nativeTx: INativeTx): Promise<string> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  jsonToNativeTx(json: string): Promise<INativeTx> {
    throw new NotImplemented();
  }
}
