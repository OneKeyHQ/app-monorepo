import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { RequestScene } from './scenes/request';

export class AddressInputScope extends BaseScope {
  protected override scopeName = EScopeName.addressInput;

  request = this.createScene('request', RequestScene);
}
