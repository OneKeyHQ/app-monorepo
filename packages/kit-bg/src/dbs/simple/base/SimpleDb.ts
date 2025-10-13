export class SimpleDb {
  get prime() {
    const SimpleDbEntityPrime = import(
      '../entity/SimpleDbEntityPrime'
    ) as unknown as typeof import('../entity/SimpleDbEntityPrime').SimpleDbEntityPrime;
    const value = new SimpleDbEntityPrime();
    Object.defineProperty(this, 'prime', { value });
    return value;
  }

  get primeTransfer() {
    const SimpleDbEntityPrimeTransfer = import(
      '../entity/SimpleDbEntityPrimeTransfer'
    ) as unknown as typeof import('../entity/SimpleDbEntityPrimeTransfer').SimpleDbEntityPrimeTransfer;
    const value = new SimpleDbEntityPrimeTransfer();
    Object.defineProperty(this, 'primeTransfer', { value });
    return value;
  }

  get referralCode() {
    const SimpleDbEntityReferralCode = import(
      '../entity/SimpleDbEntityReferralCode'
    ) as unknown as typeof import('../entity/SimpleDbEntityReferralCode').SimpleDbEntityReferralCode;
    const value = new SimpleDbEntityReferralCode();
    Object.defineProperty(this, 'referralCode', { value });
    return value;
  }

  get browserTabs() {
    const SimpleDbEntityBrowserTabs = import(
      '../entity/SimpleDbEntityBrowserTabs'
    ) as unknown as typeof import('../entity/SimpleDbEntityBrowserTabs').SimpleDbEntityBrowserTabs;
    const value = new SimpleDbEntityBrowserTabs();
    Object.defineProperty(this, 'browserTabs', { value });
    return value;
  }

  get browserBookmarks() {
    const SimpleDbEntityBrowserBookmarks = import(
      '../entity/SimpleDbEntityBrowserBookmarks'
    ) as unknown as typeof import('../entity/SimpleDbEntityBrowserBookmarks').SimpleDbEntityBrowserBookmarks;
    const value = new SimpleDbEntityBrowserBookmarks();
    Object.defineProperty(this, 'browserBookmarks', { value });
    return value;
  }

  get browserClosedTabs() {
    const SimpleDbEntityBrowserClosedTabs = import(
      '../entity/SimpleDbEntityBrowserClosedTabs'
    ) as unknown as typeof import('../entity/SimpleDbEntityBrowserClosedTabs').SimpleDbEntityBrowserClosedTabs;
    const value = new SimpleDbEntityBrowserClosedTabs();
    Object.defineProperty(this, 'browserClosedTabs', { value });
    return value;
  }

  get browserRiskWhiteList() {
    const SimpleDbEntityBrowserRiskWhiteList = import(
      '../entity/SimpleDbEntityBrowserRiskWhiteList'
    ) as unknown as typeof import('../entity/SimpleDbEntityBrowserRiskWhiteList').SimpleDbEntityBrowserRiskWhiteList;
    const value = new SimpleDbEntityBrowserRiskWhiteList();
    Object.defineProperty(this, 'browserRiskWhiteList', { value });
    return value;
  }

  get dappConnection() {
    const SimpleDbEntityDappConnection = import(
      '../entity/SimpleDbEntityDappConnection'
    ) as unknown as typeof import('../entity/SimpleDbEntityDappConnection').SimpleDbEntityDappConnection;
    const value = new SimpleDbEntityDappConnection();
    Object.defineProperty(this, 'dappConnection', { value });
    return value;
  }

  get browserHistory() {
    const SimpleDbEntityBrowserHistory = import(
      '../entity/SimpleDbEntityBrowserHistory'
    ) as unknown as typeof import('../entity/SimpleDbEntityBrowserHistory').SimpleDbEntityBrowserHistory;
    const value = new SimpleDbEntityBrowserHistory();
    Object.defineProperty(this, 'browserHistory', { value });
    return value;
  }

  get accountSelector() {
    const SimpleDbEntityAccountSelector = import(
      '../entity/SimpleDbEntityAccountSelector'
    ) as unknown as typeof import('../entity/SimpleDbEntityAccountSelector').SimpleDbEntityAccountSelector;
    const value = new SimpleDbEntityAccountSelector();
    Object.defineProperty(this, 'accountSelector', { value });
    return value;
  }

  get appCleanup() {
    const SimpleDbEntityAppCleanup = import(
      '../entity/SimpleDbEntityAppCleanup'
    ) as unknown as typeof import('../entity/SimpleDbEntityAppCleanup').SimpleDbEntityAppCleanup;
    const value = new SimpleDbEntityAppCleanup();
    Object.defineProperty(this, 'appCleanup', { value });
    return value;
  }

  get swapNetworksSort() {
    const SimpleDbEntitySwapNetworksSort = import(
      '../entity/SimpleDbEntitySwapNetworksSort'
    ) as unknown as typeof import('../entity/SimpleDbEntitySwapNetworksSort').SimpleDbEntitySwapNetworksSort;
    const value = new SimpleDbEntitySwapNetworksSort();
    Object.defineProperty(this, 'swapNetworksSort', { value });
    return value;
  }

  get swapHistory() {
    const SimpleDbEntitySwapHistory = import(
      '../entity/SimpleDbEntitySwapHistory'
    ) as unknown as typeof import('../entity/SimpleDbEntitySwapHistory').SimpleDbEntitySwapHistory;
    const value = new SimpleDbEntitySwapHistory();
    Object.defineProperty(this, 'swapHistory', { value });
    return value;
  }

  get swapConfigs() {
    const SimpleDbEntitySwapConfigs = import(
      '../entity/SimpleDbEntitySwapConfigs'
    ) as unknown as typeof import('../entity/SimpleDbEntitySwapConfigs').SimpleDbEntitySwapConfigs;
    const value = new SimpleDbEntitySwapConfigs();
    Object.defineProperty(this, 'swapConfigs', { value });
    return value;
  }

  get localTokens() {
    const SimpleDbEntityLocalTokens = import(
      '../entity/SimpleDbEntityLocalTokens'
    ) as unknown as typeof import('../entity/SimpleDbEntityLocalTokens').SimpleDbEntityLocalTokens;
    const value = new SimpleDbEntityLocalTokens();
    Object.defineProperty(this, 'localTokens', { value });
    return value;
  }

  get addressBook() {
    const SimpleDbEntityAddressBook = import(
      '../entity/SimpleDbEntityAddressBook'
    ) as unknown as typeof import('../entity/SimpleDbEntityAddressBook').SimpleDbEntityAddressBook;
    const value = new SimpleDbEntityAddressBook();
    Object.defineProperty(this, 'addressBook', { value });
    return value;
  }

  get localHistory() {
    const SimpleDbEntityLocalHistory = import(
      '../entity/SimpleDbEntityLocalHistory'
    ) as unknown as typeof import('../entity/SimpleDbEntityLocalHistory').SimpleDbEntityLocalHistory;
    const value = new SimpleDbEntityLocalHistory();
    Object.defineProperty(this, 'localHistory', { value });
    return value;
  }

  get riskyTokens() {
    const SimpleDbEntityRiskyTokens = import(
      '../entity/SimpleDbEntityRiskyTokens'
    ) as unknown as typeof import('../entity/SimpleDbEntityRiskyTokens').SimpleDbEntityRiskyTokens;
    const value = new SimpleDbEntityRiskyTokens();
    Object.defineProperty(this, 'riskyTokens', { value });
    return value;
  }

  get defaultWalletSettings() {
    const SimpleDbEntityDefaultWalletSettings = import(
      '../entity/SimpleDbEntityDefaultWalletSettings'
    ) as unknown as typeof import('../entity/SimpleDbEntityDefaultWalletSettings').SimpleDbEntityDefaultWalletSettings;
    const value = new SimpleDbEntityDefaultWalletSettings();
    Object.defineProperty(this, 'defaultWalletSettings', { value });
    return value;
  }

  get networkSelector() {
    const SimpleDbEntityNetworkSelector = import(
      '../entity/SimpleDbEntityNetworkSelector'
    ) as unknown as typeof import('../entity/SimpleDbEntityNetworkSelector').SimpleDbEntityNetworkSelector;
    const value = new SimpleDbEntityNetworkSelector();
    Object.defineProperty(this, 'networkSelector', { value });
    return value;
  }

  get notificationSettings() {
    const SimpleDbEntityNotificationSettings = import(
      '../entity/SimpleDbEntityNotificationSettings'
    ) as unknown as typeof import('../entity/SimpleDbEntityNotificationSettings').SimpleDbEntityNotificationSettings;
    const value = new SimpleDbEntityNotificationSettings();
    Object.defineProperty(this, 'notificationSettings', { value });
    return value;
  }

  get lightning() {
    const SimpleDbEntityLightning = import(
      '../entity/SimpleDbEntityLightning'
    ) as unknown as typeof import('../entity/SimpleDbEntityLightning').SimpleDbEntityLightning;
    const value = new SimpleDbEntityLightning();
    Object.defineProperty(this, 'lightning', { value });
    return value;
  }

  get feeInfo() {
    const SimpleDbEntityFeeInfo = import(
      '../entity/SimpleDbEntityFeeInfo'
    ) as unknown as typeof import('../entity/SimpleDbEntityFeeInfo').SimpleDbEntityFeeInfo;
    const value = new SimpleDbEntityFeeInfo();
    Object.defineProperty(this, 'feeInfo', { value });
    return value;
  }

  get marketWatchList() {
    const SimpleDbEntityMarketWatchList = import(
      '../entity/SimpleDbEntityMarketWatchList'
    ) as unknown as typeof import('../entity/SimpleDbEntityMarketWatchList').SimpleDbEntityMarketWatchList;
    const value = new SimpleDbEntityMarketWatchList();
    Object.defineProperty(this, 'marketWatchList', { value });
    return value;
  }

  get marketWatchListV2() {
    const SimpleDbEntityMarketWatchListV2 = import(
      '../entity/SimpleDbEntityMarketWatchListV2'
    ) as unknown as typeof import('../entity/SimpleDbEntityMarketWatchListV2').SimpleDbEntityMarketWatchListV2;
    const value = new SimpleDbEntityMarketWatchListV2();
    Object.defineProperty(this, 'marketWatchListV2', { value });
    return value;
  }

  get floatingIconDomainBlockList() {
    const SimpleDbEntityFloatingIconDomainBlockList = import(
      '../entity/SimpleDbEntityFloatingIconDomainBlockList'
    ) as unknown as typeof import('../entity/SimpleDbEntityFloatingIconDomainBlockList').SimpleDbEntityFloatingIconDomainBlockList;
    const value = new SimpleDbEntityFloatingIconDomainBlockList();
    Object.defineProperty(this, 'floatingIconDomainBlockList', { value });
    return value;
  }

  get floatingIconSettings() {
    const SimpleDbEntityFloatingIconSettings = import(
      '../entity/SimpleDbEntityFloatingIconSettings'
    ) as unknown as typeof import('../entity/SimpleDbEntityFloatingIconSettings').SimpleDbEntityFloatingIconSettings;
    const value = new SimpleDbEntityFloatingIconSettings();
    Object.defineProperty(this, 'floatingIconSettings', { value });
    return value;
  }

  get earn() {
    const SimpleDbEntityEarn = import(
      '../entity/SimpleDbEntityEarn'
    ) as unknown as typeof import('../entity/SimpleDbEntityEarn').SimpleDbEntityEarn;
    const value = new SimpleDbEntityEarn();
    Object.defineProperty(this, 'earn', { value });
    return value;
  }

  get earnExtra() {
    const SimpleDbEntityEarnExtra = import(
      '../entity/SimpleDbEntityEarnExtra'
    ) as unknown as typeof import('../entity/SimpleDbEntityEarnExtra').SimpleDbEntityEarnExtra;
    const value = new SimpleDbEntityEarnExtra();
    Object.defineProperty(this, 'earnExtra', { value });
    return value;
  }

  get earnOrders() {
    const SimpleDbEntityEarnOrders = import(
      '../entity/SimpleDbEntityEarnOrders'
    ) as unknown as typeof import('../entity/SimpleDbEntityEarnOrders').SimpleDbEntityEarnOrders;
    const value = new SimpleDbEntityEarnOrders();
    Object.defineProperty(this, 'earnOrders', { value });
    return value;
  }

  get universalSearch() {
    const SimpleDbEntityUniversalSearch = import(
      '../entity/SimpleDbEntityUniversalSearch'
    ) as unknown as typeof import('../entity/SimpleDbEntityUniversalSearch').SimpleDbEntityUniversalSearch;
    const value = new SimpleDbEntityUniversalSearch();
    Object.defineProperty(this, 'universalSearch', { value });
    return value;
  }

  get customTokens() {
    const SimpleDbEntityCustomTokens = import(
      '../entity/SimpleDbEntityCustomTokens'
    ) as unknown as typeof import('../entity/SimpleDbEntityCustomTokens').SimpleDbEntityCustomTokens;
    const value = new SimpleDbEntityCustomTokens();
    Object.defineProperty(this, 'customTokens', { value });
    return value;
  }

  get customRpc() {
    const SimpleDbEntityCustomRpc = import(
      '../entity/SimpleDbEntityCustomRPC'
    ) as unknown as typeof import('../entity/SimpleDbEntityCustomRPC').SimpleDbEntityCustomRpc;
    const value = new SimpleDbEntityCustomRpc();
    Object.defineProperty(this, 'customRpc', { value });
    return value;
  }

  get customNetwork() {
    const SimpleDbEntityCustomNetwork = import(
      '../entity/SimpleDbEntityCustomNetwork'
    ) as unknown as typeof import('../entity/SimpleDbEntityCustomNetwork').SimpleDbEntityCustomNetwork;
    const value = new SimpleDbEntityCustomNetwork();
    Object.defineProperty(this, 'customNetwork', { value });
    return value;
  }

  get serverNetwork() {
    const SimpleDbEntityServerNetwork = import(
      '../entity/SimpleDbEntityServerNetwork'
    ) as unknown as typeof import('../entity/SimpleDbEntityServerNetwork').SimpleDbEntityServerNetwork;
    const value = new SimpleDbEntityServerNetwork();
    Object.defineProperty(this, 'serverNetwork', { value });
    return value;
  }

  get v4MigrationResult() {
    const SimpleDbEntityV4MigrationResult = import(
      '../entity/SimpleDbEntityV4MigrationResult'
    ) as unknown as typeof import('../entity/SimpleDbEntityV4MigrationResult').SimpleDbEntityV4MigrationResult;
    const value = new SimpleDbEntityV4MigrationResult();
    Object.defineProperty(this, 'v4MigrationResult', { value });
    return value;
  }

  get accountValue() {
    const SimpleDbEntityAccountValue = import(
      '../entity/SimpleDbEntityAccountValue'
    ) as unknown as typeof import('../entity/SimpleDbEntityAccountValue').SimpleDbEntityAccountValue;
    const value = new SimpleDbEntityAccountValue();
    Object.defineProperty(this, 'accountValue', { value });
    return value;
  }

  get legacyWalletNames() {
    const SimpleDbEntityLegacyWalletNames = import(
      '../entity/SimpleDbEntityLegacyWalletNames'
    ) as unknown as typeof import('../entity/SimpleDbEntityLegacyWalletNames').SimpleDbEntityLegacyWalletNames;
    const value = new SimpleDbEntityLegacyWalletNames();
    Object.defineProperty(this, 'legacyWalletNames', { value });
    return value;
  }

  get localNFTs() {
    const SimpleDbEntityLocalNFTs = import(
      '../entity/SimpleDbEntityLocalNFTs'
    ) as unknown as typeof import('../entity/SimpleDbEntityLocalNFTs').SimpleDbEntityLocalNFTs;
    const value = new SimpleDbEntityLocalNFTs();
    Object.defineProperty(this, 'localNFTs', { value });
    return value;
  }

  get babylonSync() {
    const SimpleDbEntityBabylonSync = import(
      '../entity/SimpleDbEntityBabylonSync'
    ) as unknown as typeof import('../entity/SimpleDbEntityBabylonSync').SimpleDbEntityBabylonSync;
    const value = new SimpleDbEntityBabylonSync();
    Object.defineProperty(this, 'babylonSync', { value });
    return value;
  }

  get appStatus() {
    const SimpleDbEntityAppStatus = import(
      '../entity/SimpleDbEntityAppStatus'
    ) as unknown as typeof import('../entity/SimpleDbEntityAppStatus').SimpleDbEntityAppStatus;
    const value = new SimpleDbEntityAppStatus();
    Object.defineProperty(this, 'appStatus', { value });
    return value;
  }

  get allNetworks() {
    const SimpleDbEntityAllNetworks = import(
      '../entity/SimpleDbEntityAllNetworks'
    ) as unknown as typeof import('../entity/SimpleDbEntityAllNetworks').SimpleDbEntityAllNetworks;
    const value = new SimpleDbEntityAllNetworks();
    Object.defineProperty(this, 'allNetworks', { value });
    return value;
  }

  get changeHistory() {
    const SimpleDbEntityChangeHistory = import(
      '../entity/SimpleDbEntityChangeHistory'
    ) as unknown as typeof import('../entity/SimpleDbEntityChangeHistory').SimpleDbEntityChangeHistory;
    const value = new SimpleDbEntityChangeHistory();
    Object.defineProperty(this, 'changeHistory', { value });
    return value;
  }

  get recentNetworks() {
    const SimpleDbEntityRecentNetworks = import(
      '../entity/SimpleDbEntityRecentNetworks'
    ) as unknown as typeof import('../entity/SimpleDbEntityRecentNetworks').SimpleDbEntityRecentNetworks;
    const value = new SimpleDbEntityRecentNetworks();
    Object.defineProperty(this, 'recentNetworks', { value });
    return value;
  }

  get addressInfo() {
    const SimpleDbEntityAddressInfo = import(
      '../entity/SimpleDbEntityAddressInfo'
    ) as unknown as typeof import('../entity/SimpleDbEntityAddressInfo').SimpleDbEntityAddressInfo;
    const value = new SimpleDbEntityAddressInfo();
    Object.defineProperty(this, 'addressInfo', { value });
    return value;
  }

  get recentRecipients() {
    const SimpleDbEntityRecentRecipients = import(
      '../entity/SimpleDbEntityRecentRecipients'
    ) as unknown as typeof import('../entity/SimpleDbEntityRecentRecipients').SimpleDbEntityRecentRecipients;
    const value = new SimpleDbEntityRecentRecipients();
    Object.defineProperty(this, 'recentRecipients', { value });
    return value;
  }

  get riskTokenManagement() {
    const SimpleDbEntityRiskTokenManagement = import(
      '../entity/SimpleDbEntityRiskTokenManagement'
    ) as unknown as typeof import('../entity/SimpleDbEntityRiskTokenManagement').SimpleDbEntityRiskTokenManagement;
    const value = new SimpleDbEntityRiskTokenManagement();
    Object.defineProperty(this, 'riskTokenManagement', { value });
    return value;
  }

  get walletBanner() {
    const SimpleDbEntityWalletBanner = import(
      '../entity/SimpleDbEntityWalletBanner'
    ) as unknown as typeof import('../entity/SimpleDbEntityWalletBanner').SimpleDbEntityWalletBanner;
    const value = new SimpleDbEntityWalletBanner();
    Object.defineProperty(this, 'walletBanner', { value });
    return value;
  }

  get perp() {
    const SimpleDbEntityPerp = import(
      '../entity/SimpleDbEntityPerp'
    ) as unknown as typeof import('../entity/SimpleDbEntityPerp').SimpleDbEntityPerp;
    const value = new SimpleDbEntityPerp();
    Object.defineProperty(this, 'perp', { value });
    return value;
  }

  get approval() {
    const SimpleDbEntityApproval = import(
      '../entity/SimpleDbEntityApproval'
    ) as unknown as typeof import('../entity/SimpleDbEntityApproval').SimpleDbEntityApproval;
    const value = new SimpleDbEntityApproval();
    Object.defineProperty(this, 'approval', { value });
    return value;
  }

  get aggregateToken() {
    const SimpleDbEntityAggregateToken = import(
      '../entity/SimpleDbEntityAggregateToken'
    ) as unknown as typeof import('../entity/SimpleDbEntityAggregateToken').SimpleDbEntityAggregateToken;
    const value = new SimpleDbEntityAggregateToken();
    Object.defineProperty(this, 'aggregateToken', { value });
    return value;
  }

  get chainResource() {
    const SimpleDbEntityChainResource = import(
      '../entity/SimpleDbEntityChainResource'
    ) as unknown as typeof import('../entity/SimpleDbEntityChainResource').SimpleDbEntityChainResource;
    const value = new SimpleDbEntityChainResource();
    Object.defineProperty(this, 'chainResource', { value });
    return value;
  }
}
