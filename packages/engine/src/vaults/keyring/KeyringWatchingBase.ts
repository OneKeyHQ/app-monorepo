/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { CredentialType } from '../../types/credential';

import { KeyringBase } from './KeyringBase';

import type { WatchingCredential } from '../../types/credential';
import type { ISignCredentialOptions } from '../../types/vault';

export abstract class KeyringWatchingBase extends KeyringBase {
  async getCredential(
    options: ISignCredentialOptions,
  ): Promise<WatchingCredential> {
    return { type: CredentialType.WATCHING };
  }
}
