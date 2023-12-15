import { BackgroundServiceProxyBase } from '../../../apis/BackgroundServiceProxyBase';

import type { SimpleDb } from './SimpleDb';
import type { BackgroundApiProxyBase } from '../../../apis/BackgroundApiProxyBase';
import type { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import type { SimpleDbEntityBrowserBookmarks } from '../entity/SimpleDbEntityBrowserBookmarks';
import type { SimpleDbEntityBrowserHistory } from '../entity/SimpleDbEntityBrowserHistory';
import type { SimpleDbEntityBrowserTabs } from '../entity/SimpleDbEntityBrowserTabs';
import type { SimpleDbEntitySwapNetworksSort } from '../entity/SimpleDbEntitySwapNetworksSort';
import type { SimpleDbEntitySwapTokenPair } from '../entity/SimpleDbEntitySwapTokenPair';

export class SimpleDbProxy
  extends BackgroundServiceProxyBase
  implements SimpleDb
{
  override serviceNameSpace = 'simpleDb';

  constructor(backgroundApiProxy: BackgroundApiProxyBase) {
    super();
    this.backgroundApiProxy = backgroundApiProxy;
  }

  backgroundApiProxy: BackgroundApiProxyBase;

  override callBackground(method: string, ...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.backgroundApiProxy.callBackground(method, ...params);
  }

  browserTabs = this._createProxyService(
    'browserTabs',
  ) as SimpleDbEntityBrowserTabs;

  browserBookmarks = this._createProxyService(
    'browserBookmarks',
  ) as SimpleDbEntityBrowserBookmarks;

  browserHistory = this._createProxyService(
    'browserHistory',
  ) as SimpleDbEntityBrowserHistory;

  accountSelector = this._createProxyService(
    'accountSelector',
  ) as SimpleDbEntityAccountSelector;

  swapNetworksSort = this._createProxyService(
    'swapNetworksSort',
  ) as SimpleDbEntitySwapNetworksSort;

  swapTokenPair = this._createProxyService(
    'swapTokenPair',
  ) as SimpleDbEntitySwapTokenPair;
}
