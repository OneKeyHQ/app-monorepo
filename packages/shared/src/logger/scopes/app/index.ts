import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { BackgroundScene } from './scenes/background';
import { BootstrapScene } from './scenes/bootstrap';
import { ComponentScene } from './scenes/component';
import { EventBusScene } from './scenes/eventBus';
import { InstallScene } from './scenes/install';
import { NetworkScene } from './scenes/network';
import { PageScene } from './scenes/page';
import { AppPerfScene } from './scenes/perf';

export class AppScope extends BaseScope {
  protected override scopeName = EScopeName.app;

  bootstrap = this.createScene('bootstrap', BootstrapScene);

  background = this.createScene('background', BackgroundScene);

  install = this.createScene('install', InstallScene);

  network = this.createScene('network', NetworkScene);

  page = this.createScene('page', PageScene);

  component = this.createScene('component', ComponentScene);

  eventBus = this.createScene('eventBus', EventBusScene);

  perf = this.createScene('perf', AppPerfScene);
}
