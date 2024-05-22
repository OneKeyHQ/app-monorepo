import { BCS } from 'aptos';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import { generateUnsignedTransaction } from './utils';

import type VaultAptos from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.aptos.hd;

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

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    return this.baseSignMessage(params);
  }
}
