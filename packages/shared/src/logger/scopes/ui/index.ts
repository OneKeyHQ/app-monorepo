import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { ButtonScene } from './scenes/button';
import { DialogScene } from './scenes/dialog';

export class UIScope extends BaseScope {
  protected override scopeName = EScopeName.ui;

  button = this.createScene('button', ButtonScene);

  dialog = this.createScene('dialog', DialogScene);
}
