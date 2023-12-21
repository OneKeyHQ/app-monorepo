/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

export abstract class KeyringWatchingBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.watching;

  async signTransaction(): Promise<ISignedTxPro> {
    throw new OneKeyInternalError(
      'signTransaction is not supported for watching accounts',
    );
  }

  async signMessage(): Promise<string[]> {
    throw new OneKeyInternalError(
      'signMessage is not supported for watching accounts',
    );
  }
}
