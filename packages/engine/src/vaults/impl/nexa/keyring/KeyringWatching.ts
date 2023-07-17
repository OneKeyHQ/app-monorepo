import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { InvalidAddress } from '../../../../errors';
import { AccountType } from '../../../../types/account';
import { KeyringWatchingBase } from '../../../keyring/KeyringWatchingBase';
import { verifyNexaAddress } from '../utils';

import type { DBSimpleAccount } from '../../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, target: address, accountIdPrefix } = params;
    let normalizedAddress = '';
    let accountType = AccountType.SIMPLE;
    if (address.startsWith('nexa')) {
      const { normalizedAddress: nexaAddress, isValid } =
        verifyNexaAddress(address);
      normalizedAddress = nexaAddress || '';
      if (!isValid || typeof normalizedAddress === 'undefined') {
        throw new InvalidAddress();
      }
    } else {
      try {
        verifyNexaAddress(await this.vault.getDisplayAddress(address));
        normalizedAddress = address;
        accountType = AccountType.UTXO;
      } catch (error) {
        throw new InvalidAddress();
      }
    }

    return Promise.resolve([
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${address}`,
        name: name || '',
        type: accountType,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address: normalizedAddress,
      },
    ]);
  }
}
