import { NotImplemented } from '../../../errors';
import { VaultHelperBase } from '../../VaultHelperBase';

import type { IEncodedTxAny } from '../../../types/vault';

export default class VaultHelper extends VaultHelperBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToNativeTx(encodedTx: IEncodedTxAny): Promise<any> {
    throw new NotImplemented();
  }
}
