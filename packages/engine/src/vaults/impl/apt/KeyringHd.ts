/* eslint-disable @typescript-eslint/no-unused-vars */

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { buildSoftwareUnsignedTxAptos } from './utils';

import type { ChainSigner } from '../../../proxy';
import type { DBAccount } from '../../../types/account';
import type { IUnsignedMessageAptos } from '../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.apt.hd;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<DBAccount[]> {
    return super.basePrepareAccountsHd(params, {
      accountType: AccountType.SIMPLE,
      usedIndexes: params.indexes,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const tx = await buildSoftwareUnsignedTxAptos({
      keyring: this,
      unsignedTx,
      options,
    });
    return this.baseSignTransaction(tx, options);
  }

  override async signMessage(
    messages: IUnsignedMessageAptos[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    return this.baseSignMessage(messages, options);
  }
}
