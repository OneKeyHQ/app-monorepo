import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { OrderScene } from './scenes/order';
import { PageScene } from './scenes/page';

export class StakingScope extends BaseScope {
  protected override scopeName = EScopeName.app;

  page = this.createScene('page', PageScene);

  order = this.createScene('order', OrderScene);
}
