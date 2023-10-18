import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { KeyringHdBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringHd';

import btcForkSignUtils from '../../utils/btcForkChain/utils/btcForkSignUtils';

import type { ChainSigner } from '../../../proxy';
import type { DBUTXOAccount } from '../../../types/account';
import type { IUnsignedMessageBtc } from '../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringHd extends KeyringHdBtcFork {
  override coreApi = coreChainApi.ltc.hd;

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
    return this.basePrepareAccountsHdBtc(params);
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return btcForkSignUtils.signTransactionBtc(this, unsignedTx, options);
  }

  override async signMessage(
    messages: IUnsignedMessageBtc[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    return btcForkSignUtils.signMessageBtc(this, messages, options);
  }
}
