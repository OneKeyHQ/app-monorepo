import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { Signer } from '@onekeyfe/blockchain-libs/dist/types/secret';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../../errors';

import { KeyringBase } from './KeyringBase';

import type { ISignCredentialOptions } from '../types';

export abstract class KeyringSoftwareBase extends KeyringBase {
  // Implemented by HD & imported base.
  abstract getPrivateKeys(
    password: string,
    relPaths?: Array<string>,
  ): Promise<Record<string, Buffer>>; // full path to private key

  // Implemented by different implementations, use getPrivateKeys to build signers.
  abstract getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, Signer>>;

  // TODO: check history is added
  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const { password } = options;
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const signers = await this.getSigners(
      password,
      unsignedTx.inputs.map((input) => input.address),
    );
    debugLogger.engine('signTransaction', this.networkId, unsignedTx);
    return this.engine.providerManager.signTransaction(
      this.networkId,
      unsignedTx,
      signers,
    );
  }

  // TODO: check history is added
  async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const { password } = options;
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }

    const dbAccount = await this.getDbAccount();
    const [signer] = Object.values(
      await this.getSigners(password, [dbAccount.address]),
    );
    debugLogger.engine('signMessage', this.networkId, messages);
    return Promise.all(
      messages.map((message) =>
        this.engine.providerManager.signMessage(
          this.networkId,
          message,
          signer,
        ),
      ),
    );
  }
}
