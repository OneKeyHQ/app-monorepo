/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { ExportedPrivateKeyCredential } from '../../dbs/base';
import { OneKeyInternalError } from '../../errors';
import { CredentialType } from '../../types/credential';

import { KeyringBase } from './KeyringBase';

import type { PrivateKeyCredential } from '../../types/credential';
import type { ISignCredentialOptions } from '../../types/vault';

export abstract class KeyringImportedBase extends KeyringBase {
  async getCredential(
    options: ISignCredentialOptions,
  ): Promise<PrivateKeyCredential> {
    const { password } = options;
    if (!password) {
      throw new OneKeyInternalError(
        'KeyringImported.getCredential ERROR: password should NOT be empty',
      );
    }

    const { privateKey } = (await this.engine.dbApi.getCredential(
      this.accountId,
      password,
    )) as ExportedPrivateKeyCredential;

    return {
      type: CredentialType.PRIVATE_KEY,
      privateKey,
      password,
    };
  }
}
