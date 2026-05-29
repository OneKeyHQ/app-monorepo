import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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
    return this.baseExportAccountSecretKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    defaultLogger.account.adaDebug.step({
      tag: 'ada.KeyringHd.prepareAccounts',
      phase: 'start',
      info: `indexes=${params?.indexes?.join(',') ?? ''}`,
    });
    try {
      const accounts = await this.basePrepareAccountsHdUtxo(params, {
        checkIsAccountUsed: () => Promise.resolve({ isUsed: true }),
      });
      defaultLogger.account.adaDebug.step({
        tag: 'ada.KeyringHd.prepareAccounts',
        phase: 'done',
        info: `accounts=${accounts.length}`,
      });
      return accounts;
    } catch (e) {
      defaultLogger.account.adaDebug.step({
        tag: 'ada.KeyringHd.prepareAccounts',
        phase: 'error',
        info: String((e as Error)?.message || e),
      });
      throw e;
    }
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
