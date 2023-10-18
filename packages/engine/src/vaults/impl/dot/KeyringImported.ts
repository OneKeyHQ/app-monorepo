import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ChainSigner } from '@onekeyhq/engine/src/proxy';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { IUnsignedMessageCommon } from '@onekeyhq/engine/src/types/message';
import { KeyringImportedBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringImportedBase';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import { COINTYPE_DOT } from '@onekeyhq/shared/src/engine/engineConsts';

import { signTransactionDot } from './utils/dotSignUtils';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.dot.imported;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsImported(params, {
      accountType: AccountType.VARIANT,
      coinType: COINTYPE_DOT,
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
    // throw new Error('Method not implemented.')
    return this.baseSignMessage(messages, options);
  }
}
