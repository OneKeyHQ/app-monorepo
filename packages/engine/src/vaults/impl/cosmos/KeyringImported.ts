import { sha256 } from '@noble/hashes/sha256';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ChainSigner } from '@onekeyhq/engine/src/proxy';
import type { ICurveName } from '@onekeyhq/engine/src/secret';
import { ed25519, secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type {
  DBSimpleAccount,
  DBVariantAccount,
} from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import {
  COINTYPE_COSMOS,
  COINTYPE_COSMOS as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { pubkeyToBaseAddress } from './sdk/address';
import { generateSignBytes, serializeSignedTx } from './sdk/txBuilder';

import type {
  IGetPrivateKeysParams,
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxCosmos } from './type';

// @ts-ignore
export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.cosmos.imported;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<Record<string, Buffer>> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsImported(params, {
      accountType: AccountType.VARIANT,
      coinType: COINTYPE_COSMOS,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override async signMessage(): Promise<string[]> {
    throw new Error('method not implemented');
  }
}
