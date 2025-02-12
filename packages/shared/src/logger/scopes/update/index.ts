import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AppScene } from './scenes/app';
import { FirmwareScene } from './scenes/firmware';

export class UpdateScope extends BaseScope {
  protected override scopeName = EScopeName.app;

  app = this.createScene('app', AppScene);

  firmware = this.createScene('firmware', FirmwareScene);
}
