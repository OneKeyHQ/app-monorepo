import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { DeviceScene } from './scenes/device';

export class SettingScope extends BaseScope {
  protected override scopeName = EScopeName.demo;

  device = this.createScene('device', DeviceScene);
}
