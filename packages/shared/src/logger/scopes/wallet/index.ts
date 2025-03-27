import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { WalletActionsScene } from './scenes/walletActions';

export class WalletScope extends BaseScope {
  protected override scopeName = EScopeName.wallet;

  walletActions = this.createScene('walletActions', WalletActionsScene);
}
