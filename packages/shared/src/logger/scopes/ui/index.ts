import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { ButtonScene } from './scenes/button';

export class UIScope extends BaseScope {
  protected override scopeName = EScopeName.ui;

  button = this.createScene('button', ButtonScene);
}
