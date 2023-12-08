import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { DBAccount } from '../../../types/account';
import type { ISignedTxPro } from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override prepareAccounts(): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }

  override signTransaction(): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }
}
