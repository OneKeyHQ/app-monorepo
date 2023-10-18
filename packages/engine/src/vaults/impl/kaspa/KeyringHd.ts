import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ChainSigner } from '@onekeyhq/engine/src/proxy';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import { KeyringHdBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringHdBase';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.kaspa.hd;

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
      accountType: AccountType.SIMPLE,
      usedIndexes: params.indexes,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override async signMessage(): Promise<string[]> {
    throw new Error('method not implemented');
  }
}
