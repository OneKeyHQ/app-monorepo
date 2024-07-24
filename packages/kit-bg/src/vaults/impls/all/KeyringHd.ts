import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.onekeyall.hd;

  override async getPrivateKeys(): Promise<IGetPrivateKeysResult> {
    throw new NotImplemented();
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsHd(params);
  }

  override async signTransaction(): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  override async signMessage(): Promise<string[]> {
    throw new NotImplemented();
  }
}
