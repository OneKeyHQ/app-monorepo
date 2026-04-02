import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { LogScene } from './scenes/log';

export class NetworkDoctorScope extends BaseScope {
  protected override scopeName = EScopeName.networkDoctor;

  log = this.createScene('log', LogScene);
}
