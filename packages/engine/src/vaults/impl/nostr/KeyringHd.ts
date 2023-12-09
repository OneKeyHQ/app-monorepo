import { COINTYPE_NOSTR } from '@onekeyhq/shared/src/engine/engineConsts';

import {
  AccountType,
  type DBAccount,
  type DBVariantAccount,
} from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { NOSTR_ADDRESS_INDEX, Nostr, getNostrPath } from './helper/NostrSDK';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { IPrepareSoftwareAccountsParams } from '../../types';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { password, indexes } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    if (indexes.length !== 1) {
      throw new Error('Nostr: only one account is supported');
    }
    const accountIndex = indexes[0];
    const nostr = new Nostr(this.walletId, accountIndex, password, seed);
    const pubkey = nostr.getPublicKeyHex();
    const bech32Encoded = nostr.getPubkeyEncodedByNip19();
    const path = `${getNostrPath(accountIndex)}/${NOSTR_ADDRESS_INDEX}`;

    return [
      {
        id: `${this.walletId}--${path}`,
        name: `Nostr #${accountIndex + 1}`,
        type: AccountType.VARIANT,
        path,
        coinType: COINTYPE_NOSTR,
        address: bech32Encoded,
        pub: pubkey,
        addresses: {},
      },
    ];
  }
}
