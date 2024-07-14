import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { BrowserScene } from './scenes/browser';

export class DiscoveryScope extends BaseScope {
  protected override scopeName = EScopeName.discovery;

  browser = this.createScene('browser', BrowserScene);
}
