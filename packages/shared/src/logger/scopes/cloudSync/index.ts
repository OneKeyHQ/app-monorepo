import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { MarketScene } from './scenes/market';

export class CloudSyncScope extends BaseScope {
  protected override scopeName = EScopeName.cloudSync;

  market = this.createScene('market', MarketScene);
}
