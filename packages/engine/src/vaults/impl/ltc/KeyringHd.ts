import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ICoreUnsignedMessageBtc } from '@onekeyhq/core/src/types';
import { KeyringHdBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringHd';

import btcForkSignUtils from '../../utils/btcForkChain/utils/btcForkSignUtils';

import type { ChainSigner } from '../../../proxy';
import type { DBUTXOAccount } from '../../../types/account';
import type {
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

  override async getPrivateKeys({
    password,
    relPaths,
  }: {
    password: string;
    relPaths?: string[] | undefined;
  }): Promise<Record<string, Buffer>> {
    return this.baseGetPrivateKeys({ password, relPaths });
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
    messages: ICoreUnsignedMessageBtc[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    return btcForkSignUtils.signMessageBtc(this, messages, options);
  }
}
