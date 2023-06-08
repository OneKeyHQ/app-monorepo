import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_ETH as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { InvalidAddress } from '../../../../errors';
import { AccountType } from '../../../../types/account';
import { KeyringWatchingBase } from '../../../keyring/KeyringWatchingBase';

import type { DBSimpleAccount } from '../../../../types/account';
import type {
  IEncodedTx,
  IPrepareWatchingAccountsParams,
  ISignCredentialOptions,
} from '../../../types';

export class KeyringWatching extends KeyringWatchingBase {

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, target, accountIdPrefix } = params;
    const normalizedAddress = await this.vault.validateAddress(target);

    return Promise.resolve([
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${normalizedAddress}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address: normalizedAddress,
      },
    ]);
  }
}
