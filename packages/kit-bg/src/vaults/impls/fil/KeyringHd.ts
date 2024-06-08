import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { decrypt } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

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
  override coreApi = coreChainApi.fil.hd;

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

      const privateKey = decrypt(password, encryptedPrivateKey).toString(
        'base64',
      );
      // export lotus type private key by default
      result.privateKey = Buffer.from(
        JSON.stringify({
          'Type': 'secp256k1',
          'PrivateKey': privateKey,
        }),
      ).toString('hex');
    }

    return result;
  }
}
