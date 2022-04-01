/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
// eslint-disable-next-line max-classes-per-file
import { IVaultOptions } from '../../types/vault';
import { EngineVaultTools } from '../EngineVaultTools';

import type { CredentialSelector } from '../../types/credential';
import type { ISignCredentialOptions } from '../../types/vault';
import type { VaultBase } from '../VaultBase';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

export abstract class KeyringBase extends EngineVaultTools {
  constructor(vault: VaultBase) {
    super(vault.options);
    this.vault = vault;
  }

  vault: VaultBase;

  abstract getCredential(
    options: ISignCredentialOptions,
  ): Promise<CredentialSelector>;

  abstract signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
