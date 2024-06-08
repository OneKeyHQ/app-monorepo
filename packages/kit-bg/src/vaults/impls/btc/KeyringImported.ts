import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  ECoreApiPrivateKeySource,
  type ISignedMessagePro,
  type ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { KeyringImportedBase } from '../../base/KeyringImportedBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareImportedAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.btc.imported;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    const { password, keyType } = params;
    const networkInfo = await this.getCoreApiNetworkInfo();

    const { privateKeyRaw } = await this.getDefaultPrivateKey({
      password,
    });

    return this.coreApi.getExportedSecretKey({
      password,
      keyType,
      privateKeyRaw,
      privateKeySource: ECoreApiPrivateKeySource.imported,
      networkInfo,
    });

    // if (params.xprvt) {
    //   const privateKeysMap = await this.getPrivateKeys({
    //     password,
    //     // relPaths: ['0/0'],
    //   });
    //   const [encryptedPrivateKey] = Object.values(privateKeysMap);
    //   result.xprvt = bs58check.encode(decrypt(password, encryptedPrivateKey));
    // }
    // return result;
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsImportedUtxo(params);
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransactionBtc(params);
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // throw new NotImplemented();
    return this.baseSignMessage(params);
  }
}
