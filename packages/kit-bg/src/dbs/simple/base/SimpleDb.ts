import { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import { SimpleDbEntityBrowserBookmarks } from '../entity/SimpleDbEntityBrowserBookmarks';
import { SimpleDbEntityBrowserHistory } from '../entity/SimpleDbEntityBrowserHistory';
import { SimpleDbEntityBrowserTabs } from '../entity/SimpleDbEntityBrowserTabs';
import { SimpleDbEntitySwapNetworksSort } from '../entity/SimpleDbEntitySwapNetworksSort';
import { SimpleDbEntitySwapSlippage } from '../entity/simpleDbEntitySwapSlippage';
import { SimpleDbEntitySwapTokenPair } from '../entity/SimpleDbEntitySwapTokenPair';

export class SimpleDb {
  browserTabs = new SimpleDbEntityBrowserTabs();

  browserBookmarks = new SimpleDbEntityBrowserBookmarks();

  browserHistory = new SimpleDbEntityBrowserHistory();

  accountSelector = new SimpleDbEntityAccountSelector();

  swapNetworksSort = new SimpleDbEntitySwapNetworksSort();

  swapTokenPair = new SimpleDbEntitySwapTokenPair();

  swapSlippage = new SimpleDbEntitySwapSlippage();
}
