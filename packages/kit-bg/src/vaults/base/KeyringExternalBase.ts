/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBAccount, IDBExternalAccount } from '../../dbs/local/types';
import type {
  IPrepareAccountsParams,
  IPrepareExternalAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../types';

export abstract class KeyringExternalBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.external;

  async baseSignMessageByExternalWallet(params: ISignMessageParams) {
    return this.backgroundApi.serviceDappSide.signMessage({
      account: (await this.vault.getAccount()) as IDBExternalAccount,
      networkId: this.networkId,
      params,
    });
  }

  async baseSendTransactionByExternalWallet(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.backgroundApi.serviceDappSide.sendTransaction({
      account: (await this.vault.getAccount()) as IDBExternalAccount,
      networkId: this.networkId,
      params,
    });
  }

  override prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<IDBAccount[]> {
    throw new OneKeyInternalError(
      'prepareAccounts is not supported for external accounts, use serviceAccount directly',
    );
  }

  // use serviceAccount directly to prepare external accounts
  async basePrepareExternalAccounts(
    params: IPrepareExternalAccountsParams,
  ): Promise<IDBExternalAccount[]> {
    return [];
  }
}
