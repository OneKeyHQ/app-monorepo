import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.nostr.hd;

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
    return this.baseSignMessage(params);
  }

  async encrypt(params: {
    pubkey: string;
    plaintext: string;
    password: string;
    deviceParams: IDeviceSharedCallParams | undefined;
  }): Promise<string> {
    const { password } = params;
    const account = await this.vault.getAccount();
    const credentials = await this.baseGetCredentialsInfo(params);

    const networkInfo = await this.getCoreApiNetworkInfo();
    const encryptParams = {
      networkInfo,
      data: {
        pubkey: params.pubkey,
        plaintext: params.plaintext,
      },
      account,
      password,
      credentials,
    };
    const result = await this.coreApi.encrypt(encryptParams);
    return result;
  }

  async decrypt(params: {
    pubkey: string;
    ciphertext: string;
    password: string;
    deviceParams: IDeviceSharedCallParams | undefined;
  }): Promise<string> {
    const { password } = params;
    const account = await this.vault.getAccount();
    const credentials = await this.baseGetCredentialsInfo(params);

    const networkInfo = await this.getCoreApiNetworkInfo();
    const decryptParams = {
      networkInfo,
      data: {
        pubkey: params.pubkey,
        ciphertext: params.ciphertext,
      },
      account,
      password,
      credentials,
    };
    const result = await this.coreApi.decrypt(decryptParams);
    return result;
  }
}
