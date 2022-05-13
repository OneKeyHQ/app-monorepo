/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
// eslint-disable-next-line max-classes-per-file
import { IVaultOptions } from '../../types/vault';
import { VaultContext } from '../VaultContext';

import type { CredentialSelector } from '../../types/credential';
import type { ISignCredentialOptions } from '../../types/vault';
import type { VaultBase } from '../VaultBase';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

export abstract class KeyringBase extends VaultContext {
  constructor(vault: VaultBase) {
    super(vault.options);
    this.vault = vault;
  }

  vault: VaultBase;

  abstract getCredential(
    options: ISignCredentialOptions,
  ): Promise<CredentialSelector>;

  // TODO: check history is added
  abstract signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx>;

  // TODO: check history is added
  abstract signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
