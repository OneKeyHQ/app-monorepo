import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { CommonScene } from './scenes/common';
import { PerpDepositScene } from './scenes/deposit';
import { HyperLiquidScene } from './scenes/hyperliquid';

export class PerpScope extends BaseScope {
  protected override scopeName = EScopeName.perp;

  common = this.createScene('common', CommonScene);

  hyperliquid = this.createScene('hyperliquid', HyperLiquidScene);

  deposit = this.createScene('deposit', PerpDepositScene);
}
