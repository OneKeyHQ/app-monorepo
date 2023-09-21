import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { COINTYPE_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { AccountType } from '../../../../types/account';
import { KeyringImportedBase } from '../../../keyring/KeyringImportedBase';

import type { ChainSigner } from '../../../../proxy';
import type { DBSimpleAccount } from '../../../../types/account';
import type { IUnsignedMessageCommon } from '../../../../types/message';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.sol.imported;

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
      coinType: COINTYPE_SOL,
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
    return this.baseSignMessage(messages, options);
  }
}
