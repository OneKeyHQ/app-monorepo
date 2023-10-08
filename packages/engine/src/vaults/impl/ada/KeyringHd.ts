import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import type { ChainSigner } from '../../../proxy';
import type { DBUTXOAccount } from '../../../types/account';
import type { IUnsignedMessageCommon } from '../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type Vault from './Vault';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.ada.hd;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    return this.basePrepareAccountsHdUtxo(params, {
      addressEncoding: undefined,
      checkIsAccountUsed: async ({ address }) => {
        const client = await (this.vault as Vault).getClient();
        const { tx_count: txCount } = await client.getAddressDetails(address);
        return {
          isUsed: txCount > 0,
        };
      },
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override async signMessage(
    messages: IUnsignedMessageCommon[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    // throw new Error('Method not implemented.');
    return this.baseSignMessage(messages, options);
  }
}
