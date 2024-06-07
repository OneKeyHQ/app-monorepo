import { privateKeyFromBuffer } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
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
  override coreApi = coreChainApi.kaspa.hd;

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
    const chainId = await this.getNetworkChainId();

    if (params.privateKey) {
      const privateKeysMap = await this.getPrivateKeys({
        password,
        // relPaths: ['0/0'],
      });
      const [encryptedPrivateKey] = Object.values(privateKeysMap);
      const privateKey = decrypt(password, encryptedPrivateKey);
      const kaspaPrivateKey = privateKeyFromBuffer(privateKey, chainId);
      result.privateKey = kaspaPrivateKey.toWIF();
    }
    return result;
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
}
