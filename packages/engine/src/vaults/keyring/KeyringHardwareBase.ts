/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import * as OneKeyHardware from '../../hardware';
import { CredentialType } from '../../types/credential';

import { KeyringBase } from './KeyringBase';

import type { HardwareCredential } from '../../types/credential';
import type { ISignCredentialOptions } from '../../types/vault';

export abstract class KeyringHardwareBase extends KeyringBase {
  async getCredential(
    options: ISignCredentialOptions,
  ): Promise<HardwareCredential> {
    return { type: CredentialType.HARDWARE };
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const path = await this.getAccountPath();
    // TODO remove OneKeyHardware.signTransaction
    return OneKeyHardware.signTransaction(this.networkId, path, unsignedTx);
  }
}
