import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import { toTransaction } from './sdkSui/utils';

import type IVaultSui from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.sui.hd;

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
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSui;
    const client = await (this.vault as IVaultSui).getClient();
    const initialTransaction = await toTransaction(
      client,
      encodedTx.sender,
      encodedTx,
    );
    const rawTxUnsigned = Buffer.from(initialTransaction).toString('hex');
    return this.baseSignTransaction({
      ...params,
      unsignedTx: {
        ...params.unsignedTx,
        rawTxUnsigned,
      },
    });
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    // throw new Error('Method not implemented.');
    return this.baseSignMessage(params);
  }
}
