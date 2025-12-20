import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { RequestScene } from './scenes/request';

export class IpTableScope extends BaseScope {
  protected override scopeName = EScopeName.ipTable;

  request = this.createScene('request', RequestScene);
}
