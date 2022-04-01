/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { ExportedSeedCredential } from '../../dbs/base';
import { OneKeyInternalError } from '../../errors';
import { CredentialType } from '../../types/credential';

import { KeyringBase } from './KeyringBase';

import type { SoftwareCredential } from '../../types/credential';
import type { ISignCredentialOptions } from '../../types/vault';

export abstract class KeyringHdBase extends KeyringBase {
  async getCredential(
    options: ISignCredentialOptions,
  ): Promise<SoftwareCredential> {
    const { password } = options;
    if (!password) {
      throw new OneKeyInternalError(
        'KeyringHD.getCredential ERROR: password should NOT be empty',
      );
    }
    const walletId = await this.getWalletId();
    const { seed } = (await this.engine.dbApi.getCredential(
      walletId,
      password,
    )) as ExportedSeedCredential;
    return {
      type: CredentialType.SOFTWARE,
      seed,
      password,
    };
  }
}
