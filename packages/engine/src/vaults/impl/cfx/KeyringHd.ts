import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import type { ISignCredentialOptions } from '../../../types/vault';

export class KeyringHd extends KeyringHdBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const { networkId } = this;
    const dbAccount = await this.getDbAccount();
    const credential = await this.getCredential(options);
    const signers = this.engine.providerManager.getSigners(
      networkId,
      credential,
      dbAccount,
    );
    debugLogger.engine('CFX signTransaction', unsignedTx, signers);
    return this.engine.providerManager.signTransaction(
      networkId,
      unsignedTx,
      signers,
    );
  }

  signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
