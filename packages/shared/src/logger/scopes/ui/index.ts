import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { ActionListScene } from './scenes/actionList';
import { ButtonScene } from './scenes/button';
import { DialogScene } from './scenes/dialog';
import { PopoverScene } from './scenes/popover';

export class UIScope extends BaseScope {
  protected override scopeName = EScopeName.ui;

  button = this.createScene('button', ButtonScene);

  dialog = this.createScene('dialog', DialogScene);

  popover = this.createScene('popover', PopoverScene);

  actionList = this.createScene('actionList', ActionListScene);
}
