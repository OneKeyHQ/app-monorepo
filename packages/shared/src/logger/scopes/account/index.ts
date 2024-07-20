import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { WalletScene } from './scenes/wallet';

export class AccountScope extends BaseScope {
  protected override scopeName = EScopeName.account;

  wallet = this.createScene('wallet', WalletScene);
}
