/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
// eslint-disable-next-line max-classes-per-file
import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { EVaultKeyringTypes, IVaultOptions } from '../types';
import { VaultContext } from '../VaultContext';

import type { DBAccount } from '../../types/account';
import type { CredentialSelector } from '../../types/credential';
import type { IUnsignedMessage } from '../../types/message';
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

  abstract keyringType: EVaultKeyringTypes;

  isKeyringImported() {
    return this.keyringType === EVaultKeyringTypes.imported;
  }

  isKeyringHd() {
    return this.keyringType === EVaultKeyringTypes.hd;
  }

  isKeyringHardware() {
    return this.keyringType === EVaultKeyringTypes.hardware;
  }

  isKeyringWatching() {
    return this.keyringType === EVaultKeyringTypes.watching;
  }

  vault: VaultBase;

  coreApi: CoreChainApiBase | undefined;

  override async addressFromBase(account: DBAccount) {
    return this.vault.addressFromBase(account);
  }

  abstract signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro>;

  abstract signMessage(
    messages: IUnsignedMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]>;

  abstract prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<Array<DBAccount>>;

  // TODO merge prepareAccounts, getAddress, batchGetAddress, getAddressesFromHd, getAddressFromPrivate
  abstract getAddress(params: IGetAddressParams): Promise<string>;

  abstract batchGetAddress(
    params: IGetAddressParams[],
  ): Promise<{ path: string; address: string }[]>;

  // TODO BTC fork only?
  abstract prepareAccountByAddressIndex(
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<Array<DBAccount>>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
