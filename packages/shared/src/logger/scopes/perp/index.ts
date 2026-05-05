import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AgentLifeCycleScene } from './scenes/agentLifeCycle';
import { CommonScene } from './scenes/common';
import { PerpDepositScene } from './scenes/deposit';
import { HyperLiquidScene } from './scenes/hyperliquid';
import { PerpTokenSelectorScene } from './scenes/tokenSelector';

export class PerpScope extends BaseScope {
  protected override scopeName = EScopeName.perp;

  common = this.createScene('common', CommonScene);

  hyperliquid = this.createScene('hyperliquid', HyperLiquidScene);

  agentLifeCycle = this.createScene('agentLifeCycle', AgentLifeCycleScene);

  deposit = this.createScene('deposit', PerpDepositScene);

  tokenSelector = this.createScene('tokenSelector', PerpTokenSelectorScene);
}
