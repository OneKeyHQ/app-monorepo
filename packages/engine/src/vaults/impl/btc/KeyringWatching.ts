import { KeyringWatching as KeyringWatchingBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringWatching';
import { InvalidAddress } from '@onekeyhq/shared/src/errors';

import { AccountType } from '../../../types/account';
import { AddressEncodings } from '../../utils/btcForkChain/types';

import type { DBUTXOAccount } from '../../../types/account';
import type { IPrepareWatchingAccountsParams } from '../../types';
import type { Provider } from '../../utils/btcForkChain/provider';
import type BTCForkVault from '../../utils/btcForkChain/VaultBtcFork';

export class KeyringWatching extends KeyringWatchingBtcFork {
  checkTargetXpubOrAddress({
    target,
    provider,
  }: {
    target: string;
    provider: Provider;
  }) {
    let isXpub = true;
    let isAddress = false;
    try {
      if (!provider.isValidXpub(target)) {
        isXpub = false;
      }
    } catch (error) {
      isXpub = false;
      console.error(error);
    }
    try {
      if (!isXpub && provider.verifyAddress(target)) {
        isAddress = true;
      }
    } catch (error) {
      isAddress = false;
      console.error(error);
    }

    if (!isXpub && !isAddress) {
      throw new InvalidAddress();
    }
    return {
      isXpub,
      isAddress,
    };
  }

  override async prepareAccounts(
    params: IPrepareWatchingAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    console.log('btcfork watching prepareAccount');
    const { target, name, accountIdPrefix, template } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    const { isXpub, isAddress } = this.checkTargetXpubOrAddress({
      target,
      provider,
    });

    let addressEncoding;
    let xpubSegwit = target;
    if (template && isXpub) {
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
    let address = '';
    if (isXpub) {
      const res = provider.xpubToAddresses(
        target,
        [firstAddressRelPath],
        addressEncoding,
      );
      address = res[firstAddressRelPath];
    } else if (isAddress) {
      address = target;
    }

    return [
      {
        id: `${accountIdPrefix}--${COIN_TYPE}--${target}--${
          addressEncoding === AddressEncodings.P2TR ? `86'/` : ''
        }`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub: isXpub ? target : '',
        xpubSegwit: isXpub ? xpubSegwit : '',
        address,
        addresses: { [firstAddressRelPath]: address },
      },
    ];
  }
}
