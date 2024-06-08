import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { decrypt, ed25519 } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import { baseEncode } from './utils';

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
  override coreApi = coreChainApi.near.hd;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsHd(params);
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

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    const { password } = params;
    const result: IExportAccountSecretKeysResult = {};
    if (params.privateKey) {
      const privateKeysMap = await this.getPrivateKeys({
        password,
      });
      const [encryptedPrivateKey] = Object.values(privateKeysMap);
      const privateKey = decrypt(password, encryptedPrivateKey);
      const publicKey = ed25519.publicFromPrivate(privateKey);
      result.privateKey = `ed25519:${baseEncode(
        Buffer.concat([privateKey, publicKey]),
      )}`;
    }

    return result;
  }
}
