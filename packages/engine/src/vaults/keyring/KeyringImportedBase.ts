import type { ICoreImportedCredential } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { EVaultKeyringTypes } from '../types';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

import type { ExportedPrivateKeyCredential } from '../../dbs/base';
import type { ISignCredentialOptions } from '../types';

export abstract class KeyringImportedBase extends KeyringSoftwareBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.imported;

  // TODO remove
  override async getPrivateKeys({
    password,
    relPaths,
  }: {
    password: string;
    relPaths?: Array<string>;
  }): Promise<{ [path: string]: Buffer }> {
    if (typeof relPaths !== 'undefined') {
      // TODO: derive private keys for UTXO model.
    }

    const { privateKey } = (await this.engine.dbApi.getCredential(
      this.accountId,
      password,
    )) as ExportedPrivateKeyCredential;
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get credential.');
    }

    // imported account path always be ""
    const path = '';
    return { [path]: privateKey };
  }

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }

  override prepareAccountByAddressIndex(): Promise<[]> {
    throw new Error('Method not implemented.');
  }
}
