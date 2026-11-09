import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { ActivityHubScene } from './scenes/activityHub';
import { PageScene } from './scenes/page';
import { RedemptionScene } from './scenes/redemption';

export class ReferralScope extends BaseScope {
  protected override scopeName = EScopeName.referral;

  page = this.createScene('page', PageScene);

  redemption = this.createScene('redemption', RedemptionScene);

  activityHub = this.createScene('activityHub', ActivityHubScene);
}
