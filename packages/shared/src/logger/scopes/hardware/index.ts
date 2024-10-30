import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { HardwareHomeScreenScene } from './scenes/homescreen';
import { HardwareSDKScene } from './scenes/sdk';

export class HardwareScope extends BaseScope {
  protected override scopeName = EScopeName.hardware;

  sdkLog = this.createScene('sdkLog', HardwareSDKScene);

  homescreen = this.createScene('homescreen', HardwareHomeScreenScene);
}
