import {
  CoinType,
  decode,
  encode,
  validateAddressString,
} from '@glif/filecoin-address';

import { COINTYPE_FIL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { InvalidAddress } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

import type { DBVariantAccount } from '../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../types';

export class KeyringWatching extends KeyringWatchingBase {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, target, accountIdPrefix } = params;
    const network = await this.getNetwork();
    const isValid = validateAddressString(target);
    const normalizedAddress = isValid ? target.toLowerCase() : undefined;

    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }

    const addressObj = decode(normalizedAddress);
    const address = encode(
      network.isTestnet ? CoinType.TEST : CoinType.MAIN,
      addressObj,
    );

    return [
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${address}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub: '', // TODO: only address is supported for now.
        address,
        addresses: { [this.networkId]: address },
      },
    ];
  }
}
