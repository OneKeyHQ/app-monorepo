import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { ValidationScene } from './scenes/validation';

export class AddressInputScope extends BaseScope {
  protected override scopeName = EScopeName.addressInput;

  validation = this.createScene('validation', ValidationScene);
}
