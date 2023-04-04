/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
// eslint-disable-next-line max-classes-per-file
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';

import { IVaultOptions } from '../types';
import { VaultContext } from '../VaultContext';

import type { DBAccount } from '../../types/account';
import type { CredentialSelector } from '../../types/credential';
import type {
  IGetAddressParams,
  IPrepareAccountByAddressIndexParams,
  IPrepareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../types';
import type { VaultBase } from '../VaultBase';

export abstract class KeyringBase extends VaultContext {
  constructor(vault: VaultBase) {
    super(vault.options);
    this.vault = vault;
  }

  vault: VaultBase;

  // TODO: check history is added
  abstract signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro>;

  // TODO: check history is added
  abstract signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]>;

  abstract prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<Array<DBAccount>>;

  abstract getAddress(params: IGetAddressParams): Promise<string>;

  abstract batchGetAddress(
    params: IGetAddressParams[],
  ): Promise<{ path: string; address: string }[]>;

  override async addressFromBase(account: DBAccount) {
    return this.vault.addressFromBase(account);
  }

  abstract prepareAccountByAddressIndex(
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<Array<DBAccount>>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
