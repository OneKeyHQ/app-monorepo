import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import type { Signer } from '../../../proxy';
import type { DBAccount } from '../../../types/account';
import type { IPrepareAccountsParams } from '../../types';

export class KeyringHd extends KeyringHdBase {
  override getSigners(
    password: string,
    addresses: string[],
  ): Promise<Record<string, Signer>> {
    throw new Error('Method not implemented.');
  }

  override prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }
}
