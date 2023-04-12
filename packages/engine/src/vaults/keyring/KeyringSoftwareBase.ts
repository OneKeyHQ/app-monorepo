import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../../errors';

import { KeyringBase } from './KeyringBase';

import type { Signer } from '../../proxy';
import type { DBAccount } from '../../types/account';
import type {
  IPrepareAccountByAddressIndexParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../types';

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
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const { password } = options;
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const signers = await this.getSigners(
      password,
      unsignedTx.inputs.map((input) => input.address),
    );
    debugLogger.engine.info('signTransaction', this.networkId, unsignedTx);
    const signedTx = await this.engine.providerManager.signTransaction(
      this.networkId,
      unsignedTx,
      signers,
    );
    return {
      ...signedTx,
      encodedTx: unsignedTx.encodedTx,
    };
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
    debugLogger.engine.info('signMessage', this.networkId, messages);
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

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }

  override prepareAccountByAddressIndex(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }
}
