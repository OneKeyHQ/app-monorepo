import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { KeyringImportedBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringImported';

import btcForkSignUtils from '../../utils/btcForkChain/utils/btcForkSignUtils';

import type { ChainSigner } from '../../../proxy';
import type { DBUTXOAccount } from '../../../types/account';
import type { IUnsignedMessageBtc } from '../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringImported extends KeyringImportedBtcFork {
  override coreApi = coreChainApi.doge.imported;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    return this.basePrepareAccountsImportedBtc(params);
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
