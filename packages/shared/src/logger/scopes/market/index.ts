import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { MarketNavigationScene } from './scenes/navigation';
import { TokenScene } from './scenes/token';

export class MarketScope extends BaseScope {
  protected override scopeName = EScopeName.market;

  token = this.createScene('token', TokenScene);

  navigation = this.createScene('navigation', MarketNavigationScene);
}
