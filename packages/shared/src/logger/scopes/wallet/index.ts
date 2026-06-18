import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AddressTypeScene } from './scenes/addressType';
import { WalletBalanceScene } from './scenes/balance';
import { KeylessScene } from './scenes/keyless';
import { WalletActionsScene } from './scenes/walletActions';
import { WalletBannerScene } from './scenes/walletBanner';

export class WalletScope extends BaseScope {
  protected override scopeName = EScopeName.wallet;

  walletActions = this.createScene('walletActions', WalletActionsScene);

  walletBanner = this.createScene('walletBanner', WalletBannerScene);

  balance = this.createScene('balance', WalletBalanceScene);

  addressType = this.createScene('addressType', AddressTypeScene);

  keyless = this.createScene('keyless', KeylessScene);
}
