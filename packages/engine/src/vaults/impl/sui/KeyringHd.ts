/* eslint-disable @typescript-eslint/no-unused-vars */

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { COINTYPE_SUI as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { toUnsignedRawTx } from './utils';

import type { ChainSigner } from '../../../proxy';
import type { DBSimpleAccount, DBVariantAccount } from '../../../types/account';
import type { IUnsignedMessageCommon } from '../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.sui.hd;

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
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsHd(params, {
      accountType: AccountType.SIMPLE,
      usedIndexes: params.indexes,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    // eslint-disable-next-line no-param-reassign
    unsignedTx = await toUnsignedRawTx({
      rpcURL,
      dbAccount,
      unsignedTx,
    });
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
