import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';

import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { signTransaction } from './utils';

import type { ChainSigner } from '../../../proxy';
import type { DBAccount } from '../../../types/account';
import type {
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.algo.hd;

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<DBAccount[]> {
    return super.basePrepareAccountsHd(params, {
      accountType: AccountType.SIMPLE,
      usedIndexes: params.indexes,
    });
  }

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    throw new Error('Method not implemented.');
  }
}
