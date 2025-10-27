import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AccountSelectorAutoSelectScene } from './scenes/autoSelect';
import { AccountSelectorPerfScene } from './scenes/perf';
import { AccountSelectorRenderScene } from './scenes/render';
import { AccountSelectorStorageScene } from './scenes/storage';

export class AccountSelectorScope extends BaseScope {
  protected override scopeName = EScopeName.accountSelector;

  render = this.createScene('render', AccountSelectorRenderScene);

  perf = this.createScene('perf', AccountSelectorPerfScene);

  storage = this.createScene('storage', AccountSelectorStorageScene);

  autoSelect = this.createScene('autoSelect', AccountSelectorAutoSelectScene);
}
