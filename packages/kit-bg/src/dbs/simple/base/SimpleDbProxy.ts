import { BackgroundServiceProxyBase } from '../../../apis/BackgroundServiceProxyBase';

import type { SimpleDb } from './SimpleDb';
import type { BackgroundApiProxyBase } from '../../../apis/BackgroundApiProxyBase';
import type { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import type { SimpleDbEntityAccountValue } from '../entity/SimpleDbEntityAccountValue';
import type { SimpleDbEntityAddressBook } from '../entity/SimpleDbEntityAddressBook';
import type { SimpleDbEntityBabylonSync } from '../entity/SimpleDbEntityBabylonSync';
import type { SimpleDbEntityBrowserBookmarks } from '../entity/SimpleDbEntityBrowserBookmarks';
import type { SimpleDbEntityBrowserClosedTabs } from '../entity/SimpleDbEntityBrowserClosedTabs';
import type { SimpleDbEntityBrowserHistory } from '../entity/SimpleDbEntityBrowserHistory';
import type { SimpleDbEntityBrowserRiskWhiteList } from '../entity/SimpleDbEntityBrowserRiskWhiteList';
import type { SimpleDbEntityBrowserTabs } from '../entity/SimpleDbEntityBrowserTabs';
import type { SimpleDbEntityCustomNetwork } from '../entity/SimpleDbEntityCustomNetwork';
import type { SimpleDbEntityCustomRpc } from '../entity/SimpleDbEntityCustomRPC';
import type { SimpleDbEntityCustomTokens } from '../entity/SimpleDbEntityCustomTokens';
import type { SimpleDbEntityDappConnection } from '../entity/SimpleDbEntityDappConnection';
import type { SimpleDbEntityDefaultWalletSettings } from '../entity/SimpleDbEntityDefaultWalletSettings';
import type { SimpleDbEntityEarn } from '../entity/SimpleDbEntityEarn';
import type { SimpleDbEntityFeeInfo } from '../entity/SimpleDbEntityFeeInfo';
import type { SimpleDbEntityLegacyWalletNames } from '../entity/SimpleDbEntityLegacyWalletNames';
import type { SimpleDbEntityLightning } from '../entity/SimpleDbEntityLightning';
import type { SimpleDbEntityLocalHistory } from '../entity/SimpleDbEntityLocalHistory';
import type { SimpleDbEntityLocalNFTs } from '../entity/SimpleDbEntityLocalNFTs';
import type { SimpleDbEntityLocalTokens } from '../entity/SimpleDbEntityLocalTokens';
import type { SimpleDbEntityMarketWatchList } from '../entity/SimpleDbEntityMarketWatchList';
import type { SimpleDbEntityNetworkSelector } from '../entity/SimpleDbEntityNetworkSelector';
import type { SimpleDbEntityNotificationSettings } from '../entity/SimpleDbEntityNotificationSettings';
import type { SimpleDbEntityRiskyTokens } from '../entity/SimpleDbEntityRiskyTokens';
import type { SimpleDbEntityServerNetwork } from '../entity/SimpleDbEntityServerNetwork';
import type { SimpleDbEntitySwapConfigs } from '../entity/SimpleDbEntitySwapConfigs';
import type { SimpleDbEntitySwapHistory } from '../entity/SimpleDbEntitySwapHistory';
import type { SimpleDbEntitySwapNetworksSort } from '../entity/SimpleDbEntitySwapNetworksSort';
import type { SimpleDbEntityUniversalSearch } from '../entity/SimpleDbEntityUniversalSearch';
import type { SimpleDbEntityV4MigrationResult } from '../entity/SimpleDbEntityV4MigrationResult';

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

  browserClosedTabs = this._createProxyService(
    'browserClosedTabs',
  ) as SimpleDbEntityBrowserClosedTabs;

  browserRiskWhiteList = this._createProxyService(
    'browserRiskWhiteList',
  ) as SimpleDbEntityBrowserRiskWhiteList;

  browserHistory = this._createProxyService(
    'browserHistory',
  ) as SimpleDbEntityBrowserHistory;

  dappConnection = this._createProxyService(
    'dappConnection',
  ) as SimpleDbEntityDappConnection;

  accountSelector = this._createProxyService(
    'accountSelector',
  ) as SimpleDbEntityAccountSelector;

  swapNetworksSort = this._createProxyService(
    'swapNetworksSort',
  ) as SimpleDbEntitySwapNetworksSort;

  swapHistory = this._createProxyService(
    'swapHistory',
  ) as SimpleDbEntitySwapHistory;

  swapConfigs = this._createProxyService(
    'swapConfigs',
  ) as SimpleDbEntitySwapConfigs;

  localTokens = this._createProxyService(
    'localTokens',
  ) as SimpleDbEntityLocalTokens;

  addressBook = this._createProxyService(
    'addressBook',
  ) as SimpleDbEntityAddressBook;

  localHistory = this._createProxyService(
    'localHistory',
  ) as SimpleDbEntityLocalHistory;

  riskyTokens = this._createProxyService(
    'riskyTokens',
  ) as SimpleDbEntityRiskyTokens;

  defaultWalletSettings = this._createProxyService(
    'defaultWalletSettings',
  ) as SimpleDbEntityDefaultWalletSettings;

  networkSelector = this._createProxyService(
    'networkSelector',
  ) as SimpleDbEntityNetworkSelector;

  notificationSettings = this._createProxyService(
    'notificationSettings',
  ) as SimpleDbEntityNotificationSettings;

  lightning = this._createProxyService('lightning') as SimpleDbEntityLightning;

  feeInfo = this._createProxyService('feeInfo') as SimpleDbEntityFeeInfo;

  marketWatchList = this._createProxyService(
    'marketWatchList',
  ) as SimpleDbEntityMarketWatchList;

  universalSearch = this._createProxyService(
    'universalSearch',
  ) as SimpleDbEntityUniversalSearch;

  customTokens = this._createProxyService(
    'customTokens',
  ) as SimpleDbEntityCustomTokens;

  customRpc = this._createProxyService('customRpc') as SimpleDbEntityCustomRpc;

  customNetwork = this._createProxyService(
    'customNetwork',
  ) as SimpleDbEntityCustomNetwork;

  serverNetwork = this._createProxyService(
    'serverNetwork',
  ) as SimpleDbEntityServerNetwork;

  v4MigrationResult = this._createProxyService(
    'v4MigrationResult',
  ) as SimpleDbEntityV4MigrationResult;

  accountValue = this._createProxyService(
    'accountValue',
  ) as SimpleDbEntityAccountValue;

  legacyWalletNames = this._createProxyService(
    'legacyWalletNames',
  ) as SimpleDbEntityLegacyWalletNames;

  earn = this._createProxyService('earn') as SimpleDbEntityEarn;

  localNFTs = this._createProxyService('localNFTs') as SimpleDbEntityLocalNFTs;

  babylonSync = this._createProxyService(
    'babylonSync',
  ) as SimpleDbEntityBabylonSync;
}
