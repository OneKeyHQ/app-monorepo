import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { RequestScene } from './scenes/request';

export class FiatCryptoScope extends BaseScope {
  protected override scopeName = EScopeName.fiatCrypto;

  request = this.createScene('request', RequestScene);
}
