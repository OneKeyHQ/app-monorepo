import { KeyringWatching as KeyringWatchingBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringWatching';

import { InvalidAddress } from '../../../errors';
import { AccountType } from '../../../types/account';
import { AddressEncodings } from '../../utils/btcForkChain/types';

import type { DBUTXOAccount } from '../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../types';
import type BTCForkVault from '../../utils/btcForkChain/VaultBtcFork';

export class KeyringWatching extends KeyringWatchingBtcFork {
  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    console.log('btcfork watching prepareAccount');
    const { target, name, accountIdPrefix, template } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    if (!provider.isValidXpub(target)) {
      throw new InvalidAddress();
    }

    let addressEncoding;
    let xpubSegwit = target;
    if (template) {
      if (template.startsWith(`m/44'/`)) {
        addressEncoding = AddressEncodings.P2PKH;
      } else if (template.startsWith(`m/86'/`)) {
        addressEncoding = AddressEncodings.P2TR;
        xpubSegwit = `tr(${target})`;
      } else {
        addressEncoding = undefined;
      }
    }

    const firstAddressRelPath = '0/0';
    const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
      target,
      [firstAddressRelPath],
      addressEncoding,
    );
    return [
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${target}--${
          addressEncoding === AddressEncodings.P2TR ? `86'/` : ''
        }`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub: target,
        xpubSegwit,
        address,
        addresses: { [firstAddressRelPath]: address },
      },
    ];
  }
}
