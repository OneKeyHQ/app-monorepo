import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { decrypt } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.ada.hd;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    const { password } = params;
    const result: IExportAccountSecretKeysResult = {};
    const account = await this.vault.getAccount();
    const credentials = await this.baseGetCredentialsInfo({ password });

    if (params.xprvt) {
      const xprv = await this.coreApi.getExportedCredentialHd({
        password,
        account,
        hdCredential: checkIsDefined(credentials.hd),
      });
      result.xprvt = xprv;
    }
    return result;
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsHdUtxo(params, {
      checkIsAccountUsed: () => Promise.resolve({ isUsed: true }),
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(params);
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    // throw new NotImplemented();;
    return this.baseSignMessage(params);
  }
}
