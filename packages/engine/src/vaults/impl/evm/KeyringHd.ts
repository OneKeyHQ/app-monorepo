import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { ISignCredentialOptions } from '../../../types/vault';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import type { IUnsignedMessageEvm } from './Vault';

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
    debugLogger.engine('EVM signTransaction', unsignedTx, signers);
    return this.engine.providerManager.signTransaction(
      networkId,
      unsignedTx,
      signers,
    );
  }

  async signMessage(
    messages: IUnsignedMessageEvm[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const credential = await this.getCredential(options);
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();

    return this.engine.providerManager.signMessages(
      credential,
      options.password || '',
      network,
      dbAccount,
      messages,
    );
  }
}
