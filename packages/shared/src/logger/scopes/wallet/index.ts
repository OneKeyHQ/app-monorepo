import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AddressTypeScene } from './scenes/addressType';
import { BtcFreshAddressScene } from './scenes/btcFreshAddress';
import { WalletActionsScene } from './scenes/walletActions';
import { WalletBannerScene } from './scenes/walletBanner';

export class WalletScope extends BaseScope {
  protected override scopeName = EScopeName.wallet;

  walletActions = this.createScene('walletActions', WalletActionsScene);

  walletBanner = this.createScene('walletBanner', WalletBannerScene);

  addressType = this.createScene('addressType', AddressTypeScene);

  btcFreshAddress = this.createScene(
    'btcFreshAddress',
    BtcFreshAddressScene,
  );
}
