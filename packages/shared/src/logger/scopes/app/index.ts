import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { BackgroundScene } from './scenes/background';
import { BootstrapScene } from './scenes/bootstrap';
import { InstallScene } from './scenes/install';

export class AppScope extends BaseScope {
  protected override scopeName = EScopeName.app;

  bootstrap = this.createScene('bootstrap', BootstrapScene);

  background = this.createScene('background', BackgroundScene);

  install = this.createScene('install', InstallScene);
}
