import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { RequestScene } from './scenes/request';

export class TokenScope extends BaseScope {
  protected override scopeName = EScopeName.token;

  request = this.createScene('request', RequestScene);
}
