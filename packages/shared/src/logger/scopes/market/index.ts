import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { TokenScene } from './scenes/token';

export class MarketScope extends BaseScope {
  protected override scopeName = EScopeName.market;

  token = this.createScene('token', TokenScene);
}
