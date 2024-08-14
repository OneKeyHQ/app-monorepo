import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AccountSelectorPerfScene } from './scenes/perf';
import { AccountSelectorRenderScene } from './scenes/render';

export class AccountSelectorScope extends BaseScope {
  protected override scopeName = EScopeName.accountSelector;

  render = this.createScene('render', AccountSelectorRenderScene);

  perf = this.createScene('perf', AccountSelectorPerfScene);
}
