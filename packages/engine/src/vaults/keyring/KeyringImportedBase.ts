import { NotImplemented, OneKeyInternalError } from '../../errors';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

import type { ExportedPrivateKeyCredential } from '../../dbs/base';

export abstract class KeyringImportedBase extends KeyringSoftwareBase {
  override async getPrivateKeys(
    password: string,
    relPaths?: Array<string>,
  ): Promise<Record<string, Buffer>> {
    if (typeof relPaths !== 'undefined') {
      // TODO: derive private keys for UTXO model.
      throw new NotImplemented(
        'Getting private keys from extended private key',
      );
    }

    const { privateKey } = (await this.engine.dbApi.getCredential(
      this.accountId,
      password,
    )) as ExportedPrivateKeyCredential;
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get credential.');
    }

    return { '': privateKey };
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
