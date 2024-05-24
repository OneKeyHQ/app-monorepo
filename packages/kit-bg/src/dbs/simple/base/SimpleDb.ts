import { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import { SimpleDbEntityAddressBook } from '../entity/SimpleDbEntityAddressBook';
import { SimpleDbEntityBrowserBookmarks } from '../entity/SimpleDbEntityBrowserBookmarks';
import { SimpleDbEntityBrowserHistory } from '../entity/SimpleDbEntityBrowserHistory';
import { SimpleDbEntityBrowserRiskWhiteList } from '../entity/SimpleDbEntityBrowserRiskWhiteList';
import { SimpleDbEntityBrowserTabs } from '../entity/SimpleDbEntityBrowserTabs';
import { SimpleDbEntityDappConnection } from '../entity/SimpleDbEntityDappConnection';
import { SimpleDbEntityDefaultWalletSettings } from '../entity/SimpleDbEntityDefaultWalletSettings';
import { SimpleDbEntityFeeInfo } from '../entity/SimpleDbEntityFeeInfo';
import { SimpleDbEntityLightning } from '../entity/SimpleDbEntityLightning';
import { SimpleDbEntityLocalHistory } from '../entity/SimpleDbEntityLocalHistory';
import { SimpleDbEntityLocalTokens } from '../entity/SimpleDbEntityLocalTokens';
import { SimpleDbEntityMarketWatchList } from '../entity/SimpleDbEntityMarketWatchList';
import { SimpleDbEntityNetworkSelector } from '../entity/SimpleDbEntityNetworkSelector';
import { SimpleDbEntityRiskyTokens } from '../entity/SimpleDbEntityRiskyTokens';
import { SimpleDbEntitySwapConfigs } from '../entity/SimpleDbEntitySwapConfigs';
import { SimpleDbEntitySwapHistory } from '../entity/SimpleDbEntitySwapHistory';
import { SimpleDbEntitySwapNetworksSort } from '../entity/SimpleDbEntitySwapNetworksSort';
import { SimpleDbEntityUniversalSearch } from '../entity/SimpleDbEntityUniversalSearch';

export class SimpleDb {
  browserTabs = new SimpleDbEntityBrowserTabs();

  browserBookmarks = new SimpleDbEntityBrowserBookmarks();

  browserRiskWhiteList = new SimpleDbEntityBrowserRiskWhiteList();

  dappConnection = new SimpleDbEntityDappConnection();

  browserHistory = new SimpleDbEntityBrowserHistory();

  accountSelector = new SimpleDbEntityAccountSelector();

  swapNetworksSort = new SimpleDbEntitySwapNetworksSort();

  swapHistory = new SimpleDbEntitySwapHistory();

  swapConfigs = new SimpleDbEntitySwapConfigs();

  localTokens = new SimpleDbEntityLocalTokens();

  addressBook = new SimpleDbEntityAddressBook();

  localHistory = new SimpleDbEntityLocalHistory();

  riskyTokens = new SimpleDbEntityRiskyTokens();

  defaultWalletSettings = new SimpleDbEntityDefaultWalletSettings();

  networkSelector = new SimpleDbEntityNetworkSelector();

  lightning = new SimpleDbEntityLightning();

  feeInfo = new SimpleDbEntityFeeInfo();

  marketWatchList = new SimpleDbEntityMarketWatchList();

  universalSearch = new SimpleDbEntityUniversalSearch();
}
