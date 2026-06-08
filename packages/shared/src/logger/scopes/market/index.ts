import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { ChartScene } from './scenes/chart';
import { TokenScene } from './scenes/token';

export class MarketScope extends BaseScope {
  protected override scopeName = EScopeName.market;

  token = this.createScene('token', TokenScene);

  chart = this.createScene('chart', ChartScene);
}
