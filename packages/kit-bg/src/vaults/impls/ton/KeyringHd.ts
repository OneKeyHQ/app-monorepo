import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import {
  getAccountVersion,
  serializeUnsignedTransaction,
} from './sdkTon/utils';

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
  override coreApi = coreChainApi.ton.hd;

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

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    return this.baseExportAccountSecretKeys(params);
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxTon;
    const account = await this.vault.getAccount();
    const version = getAccountVersion(account.id);
    const serializeUnsignedTx = await serializeUnsignedTransaction({
      version,
      encodedTx,
      backgroundApi: this.vault.backgroundApi,
      networkId: this.vault.networkId,
    });
    params.unsignedTx.rawTxUnsigned = hexUtils.hexlify(
      await serializeUnsignedTx.signingMessage.toBoc(),
      {
        noPrefix: true,
      },
    );
    return this.baseSignTransaction(params);
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    return this.baseSignMessage(params);
  }
}
