import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { PrimeSubscriptionScene } from './scenes/subscription';
import { PrimeUsageScene } from './scenes/usage';

export class PrimeScope extends BaseScope {
  protected override scopeName = EScopeName.prime;

  subscription = this.createScene('subscription', PrimeSubscriptionScene);

  usage = this.createScene('usage', PrimeUsageScene);
}
