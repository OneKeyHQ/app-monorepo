import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { CreateOrderScene } from './scenes/createOrder';

export class SwapScope extends BaseScope {
  protected override scopeName = EScopeName.swap;

  createSwapOrder = this.createScene('createSwapOrder', CreateOrderScene);
}
