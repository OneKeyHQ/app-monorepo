import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringImportedBase } from '../../base/KeyringImportedBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IGetPrivateKeysResult } from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.dnx.imported;

  override async getPrivateKeys(): Promise<IGetPrivateKeysResult> {
    throw new NotImplemented('Method not implemented');
  }

  override async prepareAccounts(): Promise<IDBAccount[]> {
    throw new NotImplemented('Method not implemented');
  }

  override async signTransaction(): Promise<ISignedTxPro> {
    throw new NotImplemented('Method not implemented');
  }

  override async signMessage(): Promise<ISignedMessagePro> {
    throw new NotImplemented('Method not implemented');
  }
}
