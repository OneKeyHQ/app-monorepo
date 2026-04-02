import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { TronRewardScene } from './scenes/tronReward';

export class RewardScope extends BaseScope {
  protected override scopeName = EScopeName.reward;

  tronReward = this.createScene('tronReward', TronRewardScene);
}
