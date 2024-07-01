import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AppScene } from './scenes/app';

export class UpdateScope extends BaseScope {
  protected override scopeName = EScopeName.app;

  app = this.createScene('app', AppScene);
}
