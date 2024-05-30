import { BCS } from 'aptos';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringImportedBase } from '../../base/KeyringImportedBase';

import { generateUnsignedTransaction } from './utils';

import type VaultAptos from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareImportedAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.aptos.imported;

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

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const rawTxn = await generateUnsignedTransaction(
      (this.vault as VaultAptos).client,
      params.unsignedTx,
    );
    const serializer = new BCS.Serializer();
    rawTxn.serialize(serializer);
    return this.baseSignTransaction({
      ...params,
      unsignedTx: {
        ...unsignedTx,
        rawTxUnsigned: bufferUtils.bytesToHex(serializer.getBytes()),
      },
    });
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // throw new NotImplemented();
    return this.baseSignMessage(params);
  }
}
