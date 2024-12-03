import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringImportedBase } from '../../base/KeyringImportedBase';

import {
  createSignedExternalMessage,
  getAccountVersion,
  getWalletContractInstance,
  serializeUnsignedTransaction,
} from './sdkTon/utils';

import type { IWallet } from './sdkTon/utils';
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
  override coreApi = coreChainApi.ton.imported;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsImported(params);
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
    const contract = getWalletContractInstance({
      version,
      publicKey: account.pub ?? '',
      backgroundApi: this.vault.backgroundApi,
      networkId: this.vault.networkId,
    }) as unknown as IWallet;

    const serializeUnsignedTx = await serializeUnsignedTransaction({
      contract,
      encodedTx,
    });
    params.unsignedTx.rawTxUnsigned = hexUtils.hexlify(
      await serializeUnsignedTx.signingMessage.toBoc(),
      {
        noPrefix: true,
      },
    );

    const signedTx = await this.baseSignTransaction(params);

    const externalMessage = await createSignedExternalMessage({
      contract,
      encodedTx,
      signature: signedTx.signature ?? '',
      signingMessage: serializeUnsignedTx.signingMessage,
    });

    return {
      ...signedTx,
      rawTx: Buffer.from(await externalMessage.message.toBoc(false)).toString(
        'base64',
      ),
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    return this.baseSignMessage(params);
  }
}
