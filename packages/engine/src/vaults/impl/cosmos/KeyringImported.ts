import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ChainSigner } from '@onekeyhq/engine/src/proxy';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import { COINTYPE_COSMOS } from '@onekeyhq/shared/src/engine/engineConsts';

import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import type {
  IGetPrivateKeysParams,
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.cosmos.imported;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<Record<string, Buffer>> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsImported(params, {
      accountType: AccountType.VARIANT,
      coinType: COINTYPE_COSMOS,
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
