import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { HardwareSDKScene } from './scenes/sdk';

export class HardwareScope extends BaseScope {
  protected override scopeName = EScopeName.hardware;

  sdkLog = this.createScene('hardwareSdk', HardwareSDKScene);
}
