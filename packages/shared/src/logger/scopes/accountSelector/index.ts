import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AccountSelectorRenderScene } from './scenes/render';

export class AccountSelectorScope extends BaseScope {
  protected override scopeName = EScopeName.accountSelector;

  render = this.createScene('render', AccountSelectorRenderScene);
}
