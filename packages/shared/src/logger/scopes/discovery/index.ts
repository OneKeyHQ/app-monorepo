import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { BrowserScene } from './scenes/browser';
import { DappScene } from './scenes/dapp';

export class DiscoveryScope extends BaseScope {
  protected override scopeName = EScopeName.discovery;

  browser = this.createScene('browser', BrowserScene);

  dapp = this.createScene('dapp', DappScene);
}
