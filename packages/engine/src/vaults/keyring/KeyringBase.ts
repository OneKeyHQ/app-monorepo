/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
// eslint-disable-next-line max-classes-per-file
import { IVaultOptions } from '../types';
import { VaultContext } from '../VaultContext';

import type { DBAccount } from '../../types/account';
import type { CredentialSelector } from '../../types/credential';
import type {
  IGetAddressParams,
  IPrepareAccountsParams,
  ISignCredentialOptions,
} from '../types';
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

  abstract prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<Array<DBAccount>>;

  abstract getAddress(params: IGetAddressParams): Promise<string>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
