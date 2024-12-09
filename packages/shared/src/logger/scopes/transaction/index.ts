import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { CoinSelectScene } from './scenes/coinselect';
import { ReceiveScene } from './scenes/receive';
import { SendScene } from './scenes/send';

export class TransactionScope extends BaseScope {
  protected override scopeName = EScopeName.transaction;

  receive = this.createScene('receive', ReceiveScene);

  send = this.createScene('send', SendScene);

  coinSelect = this.createScene('coinSelect', CoinSelectScene);
}
