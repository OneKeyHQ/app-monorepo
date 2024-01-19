import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';

import { EDBAccountType } from '../../../dbs/local/consts';
import { KeyringImportedBase } from '../../base/KeyringImportedBase';

import type { IDBSimpleAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareImportedAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.evm.imported;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<IDBSimpleAccount>> {
    const settings = await this.getVaultSettings();
    return this.basePrepareAccountsImported(params, {
      accountType: EDBAccountType.SIMPLE,
      coinType: params.deriveInfo?.coinType || settings.coinTypeDefault,
      impl: settings.impl,
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(params);
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // throw new Error('Method not implemented.')
    return this.baseSignMessage(params);
  }
}
