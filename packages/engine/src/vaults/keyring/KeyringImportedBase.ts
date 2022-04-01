/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { CredentialType } from '../../types/credential';

import { KeyringBase } from './KeyringBase';

import type { ImportedCredential } from '../../types/credential';
import type { ISignCredentialOptions } from '../../types/vault';

export abstract class KeyringImportedBase extends KeyringBase {
  async getCredential(
    options: ISignCredentialOptions,
  ): Promise<ImportedCredential> {
    return { type: CredentialType.IMPORTED };
  }
}
