import sdk from '@onekeyhq/core/src/chains/algo/sdkAlgo';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import {
  COINTYPE_ALGO,
  COINTYPE_ALGO as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { signTransaction } from './utils';

import type { ChainSigner } from '../../../proxy';
import type { DBSimpleAccount } from '../../../types/account';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.algo.imported;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(query: {
    password: string;
    relPaths?: string[] | undefined;
  }): Promise<Record<string, Buffer>> {
    return this.baseGetPrivateKeys(query);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsImported(params, {
      accountType: AccountType.SIMPLE,
      coinType: COINTYPE_ALGO,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override signMessage(): any {
    throw new Error('Method not implemented.');
  }
}
