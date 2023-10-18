import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ChainSigner } from '@onekeyhq/engine/src/proxy';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { IUnsignedMessageCommon } from '@onekeyhq/engine/src/types/message';
import { KeyringHdBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringHdBase';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';

import { signTransactionDot } from './utils/dotSignUtils';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.dot.hd;

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
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsHd(params, {
      accountType: AccountType.VARIANT,
      usedIndexes: params.indexes,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return signTransactionDot({
      keyring: this,
      unsignedTx,
      options,
    });
  }

  override async signMessage(
    messages: IUnsignedMessageCommon[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    // throw new Error('Method not implemented.');
    return this.baseSignMessage(messages, options);
  }
}
