export class SimpleDb {
  // Lazy load entities using getters
  get prime() {
    const SimpleDbEntityPrime = (
      require('../entity/SimpleDbEntityPrime') as unknown as typeof import('../entity/SimpleDbEntityPrime')
    ).SimpleDbEntityPrime;
    const value = new SimpleDbEntityPrime();
    Object.defineProperty(this, 'prime', { value });
    return value;
  }

  get primeTransfer() {
    const SimpleDbEntityPrimeTransfer = (
      require('../entity/SimpleDbEntityPrimeTransfer') as unknown as typeof import('../entity/SimpleDbEntityPrimeTransfer')
    ).SimpleDbEntityPrimeTransfer;
    const value = new SimpleDbEntityPrimeTransfer();
    Object.defineProperty(this, 'primeTransfer', { value });
    return value;
  }

  get referralCode() {
    const SimpleDbEntityReferralCode = (
      require('../entity/SimpleDbEntityReferralCode') as unknown as typeof import('../entity/SimpleDbEntityReferralCode')
    ).SimpleDbEntityReferralCode;
    const value = new SimpleDbEntityReferralCode();
    Object.defineProperty(this, 'referralCode', { value });
    return value;
  }

  get browserTabs() {
    const SimpleDbEntityBrowserTabs = (
      require('../entity/SimpleDbEntityBrowserTabs') as unknown as typeof import('../entity/SimpleDbEntityBrowserTabs')
    ).SimpleDbEntityBrowserTabs;
    const value = new SimpleDbEntityBrowserTabs();
    Object.defineProperty(this, 'browserTabs', { value });
    return value;
  }

  get browserBookmarks() {
    const SimpleDbEntityBrowserBookmarks = (
      require('../entity/SimpleDbEntityBrowserBookmarks') as unknown as typeof import('../entity/SimpleDbEntityBrowserBookmarks')
    ).SimpleDbEntityBrowserBookmarks;
    const value = new SimpleDbEntityBrowserBookmarks();
    Object.defineProperty(this, 'browserBookmarks', { value });
    return value;
  }

  get browserClosedTabs() {
    const SimpleDbEntityBrowserClosedTabs = (
      require('../entity/SimpleDbEntityBrowserClosedTabs') as unknown as typeof import('../entity/SimpleDbEntityBrowserClosedTabs')
    ).SimpleDbEntityBrowserClosedTabs;
    const value = new SimpleDbEntityBrowserClosedTabs();
    Object.defineProperty(this, 'browserClosedTabs', { value });
    return value;
  }

  get browserRiskWhiteList() {
    const SimpleDbEntityBrowserRiskWhiteList = (
      require('../entity/SimpleDbEntityBrowserRiskWhiteList') as unknown as typeof import('../entity/SimpleDbEntityBrowserRiskWhiteList')
    ).SimpleDbEntityBrowserRiskWhiteList;
    const value = new SimpleDbEntityBrowserRiskWhiteList();
    Object.defineProperty(this, 'browserRiskWhiteList', { value });
    return value;
  }

  get dappConnection() {
    const SimpleDbEntityDappConnection = (
      require('../entity/SimpleDbEntityDappConnection') as unknown as typeof import('../entity/SimpleDbEntityDappConnection')
    ).SimpleDbEntityDappConnection;
    const value = new SimpleDbEntityDappConnection();
    Object.defineProperty(this, 'dappConnection', { value });
    return value;
  }

  get browserHistory() {
    const SimpleDbEntityBrowserHistory = (
      require('../entity/SimpleDbEntityBrowserHistory') as unknown as typeof import('../entity/SimpleDbEntityBrowserHistory')
    ).SimpleDbEntityBrowserHistory;
    const value = new SimpleDbEntityBrowserHistory();
    Object.defineProperty(this, 'browserHistory', { value });
    return value;
  }

  get accountSelector() {
    const SimpleDbEntityAccountSelector = (
      require('../entity/SimpleDbEntityAccountSelector') as unknown as typeof import('../entity/SimpleDbEntityAccountSelector')
    ).SimpleDbEntityAccountSelector;
    const value = new SimpleDbEntityAccountSelector();
    Object.defineProperty(this, 'accountSelector', { value });
    return value;
  }

  get appCleanup() {
    const SimpleDbEntityAppCleanup = (
      require('../entity/SimpleDbEntityAppCleanup') as unknown as typeof import('../entity/SimpleDbEntityAppCleanup')
    ).SimpleDbEntityAppCleanup;
    const value = new SimpleDbEntityAppCleanup();
    Object.defineProperty(this, 'appCleanup', { value });
    return value;
  }

  get swapNetworksSort() {
    const SimpleDbEntitySwapNetworksSort = (
      require('../entity/SimpleDbEntitySwapNetworksSort') as unknown as typeof import('../entity/SimpleDbEntitySwapNetworksSort')
    ).SimpleDbEntitySwapNetworksSort;
    const value = new SimpleDbEntitySwapNetworksSort();
    Object.defineProperty(this, 'swapNetworksSort', { value });
    return value;
  }

  get swapHistory() {
    const SimpleDbEntitySwapHistory = (
      require('../entity/SimpleDbEntitySwapHistory') as unknown as typeof import('../entity/SimpleDbEntitySwapHistory')
    ).SimpleDbEntitySwapHistory;
    const value = new SimpleDbEntitySwapHistory();
    Object.defineProperty(this, 'swapHistory', { value });
    return value;
  }

  get swapConfigs() {
    const SimpleDbEntitySwapConfigs = (
      require('../entity/SimpleDbEntitySwapConfigs') as unknown as typeof import('../entity/SimpleDbEntitySwapConfigs')
    ).SimpleDbEntitySwapConfigs;
    const value = new SimpleDbEntitySwapConfigs();
    Object.defineProperty(this, 'swapConfigs', { value });
    return value;
  }

  get localTokens() {
    const SimpleDbEntityLocalTokens = (
      require('../entity/SimpleDbEntityLocalTokens') as unknown as typeof import('../entity/SimpleDbEntityLocalTokens')
    ).SimpleDbEntityLocalTokens;
    const value = new SimpleDbEntityLocalTokens();
    Object.defineProperty(this, 'localTokens', { value });
    return value;
  }

  get addressBook() {
    const SimpleDbEntityAddressBook = (
      require('../entity/SimpleDbEntityAddressBook') as unknown as typeof import('../entity/SimpleDbEntityAddressBook')
    ).SimpleDbEntityAddressBook;
    const value = new SimpleDbEntityAddressBook();
    Object.defineProperty(this, 'addressBook', { value });
    return value;
  }

  get localHistory() {
    const SimpleDbEntityLocalHistory = (
      require('../entity/SimpleDbEntityLocalHistory') as unknown as typeof import('../entity/SimpleDbEntityLocalHistory')
    ).SimpleDbEntityLocalHistory;
    const value = new SimpleDbEntityLocalHistory();
    Object.defineProperty(this, 'localHistory', { value });
    return value;
  }

  get riskyTokens() {
    const SimpleDbEntityRiskyTokens = (
      require('../entity/SimpleDbEntityRiskyTokens') as unknown as typeof import('../entity/SimpleDbEntityRiskyTokens')
    ).SimpleDbEntityRiskyTokens;
    const value = new SimpleDbEntityRiskyTokens();
    Object.defineProperty(this, 'riskyTokens', { value });
    return value;
  }

  get defaultWalletSettings() {
    const SimpleDbEntityDefaultWalletSettings = (
      require('../entity/SimpleDbEntityDefaultWalletSettings') as unknown as typeof import('../entity/SimpleDbEntityDefaultWalletSettings')
    ).SimpleDbEntityDefaultWalletSettings;
    const value = new SimpleDbEntityDefaultWalletSettings();
    Object.defineProperty(this, 'defaultWalletSettings', { value });
    return value;
  }

  get networkSelector() {
    const SimpleDbEntityNetworkSelector = (
      require('../entity/SimpleDbEntityNetworkSelector') as unknown as typeof import('../entity/SimpleDbEntityNetworkSelector')
    ).SimpleDbEntityNetworkSelector;
    const value = new SimpleDbEntityNetworkSelector();
    Object.defineProperty(this, 'networkSelector', { value });
    return value;
  }

  get notificationSettings() {
    const SimpleDbEntityNotificationSettings = (
      require('../entity/SimpleDbEntityNotificationSettings') as unknown as typeof import('../entity/SimpleDbEntityNotificationSettings')
    ).SimpleDbEntityNotificationSettings;
    const value = new SimpleDbEntityNotificationSettings();
    Object.defineProperty(this, 'notificationSettings', { value });
    return value;
  }

  get lightning() {
    const SimpleDbEntityLightning = (
      require('../entity/SimpleDbEntityLightning') as unknown as typeof import('../entity/SimpleDbEntityLightning')
    ).SimpleDbEntityLightning;
    const value = new SimpleDbEntityLightning();
    Object.defineProperty(this, 'lightning', { value });
    return value;
  }

  get feeInfo() {
    const SimpleDbEntityFeeInfo = (
      require('../entity/SimpleDbEntityFeeInfo') as unknown as typeof import('../entity/SimpleDbEntityFeeInfo')
    ).SimpleDbEntityFeeInfo;
    const value = new SimpleDbEntityFeeInfo();
    Object.defineProperty(this, 'feeInfo', { value });
    return value;
  }

  get marketWatchList() {
    const SimpleDbEntityMarketWatchList = (
      require('../entity/SimpleDbEntityMarketWatchList') as unknown as typeof import('../entity/SimpleDbEntityMarketWatchList')
    ).SimpleDbEntityMarketWatchList;
    const value = new SimpleDbEntityMarketWatchList();
    Object.defineProperty(this, 'marketWatchList', { value });
    return value;
  }

  get marketWatchListV2() {
    const SimpleDbEntityMarketWatchListV2 = (
      require('../entity/SimpleDbEntityMarketWatchListV2') as unknown as typeof import('../entity/SimpleDbEntityMarketWatchListV2')
    ).SimpleDbEntityMarketWatchListV2;
    const value = new SimpleDbEntityMarketWatchListV2();
    Object.defineProperty(this, 'marketWatchListV2', { value });
    return value;
  }

  get floatingIconDomainBlockList() {
    const SimpleDbEntityFloatingIconDomainBlockList = (
      require('../entity/SimpleDbEntityFloatingIconDomainBlockList') as unknown as typeof import('../entity/SimpleDbEntityFloatingIconDomainBlockList')
    ).SimpleDbEntityFloatingIconDomainBlockList;
    const value = new SimpleDbEntityFloatingIconDomainBlockList();
    Object.defineProperty(this, 'floatingIconDomainBlockList', { value });
    return value;
  }

  get floatingIconSettings() {
    const SimpleDbEntityFloatingIconSettings = (
      require('../entity/SimpleDbEntityFloatingIconSettings') as unknown as typeof import('../entity/SimpleDbEntityFloatingIconSettings')
    ).SimpleDbEntityFloatingIconSettings;
    const value = new SimpleDbEntityFloatingIconSettings();
    Object.defineProperty(this, 'floatingIconSettings', { value });
    return value;
  }

  get earn() {
    const SimpleDbEntityEarn = (
      require('../entity/SimpleDbEntityEarn') as unknown as typeof import('../entity/SimpleDbEntityEarn')
    ).SimpleDbEntityEarn;
    const value = new SimpleDbEntityEarn();
    Object.defineProperty(this, 'earn', { value });
    return value;
  }

  get earnExtra() {
    const SimpleDbEntityEarnExtra = (
      require('../entity/SimpleDbEntityEarnExtra') as unknown as typeof import('../entity/SimpleDbEntityEarnExtra')
    ).SimpleDbEntityEarnExtra;
    const value = new SimpleDbEntityEarnExtra();
    Object.defineProperty(this, 'earnExtra', { value });
    return value;
  }

  get earnOrders() {
    const SimpleDbEntityEarnOrders = (
      require('../entity/SimpleDbEntityEarnOrders') as unknown as typeof import('../entity/SimpleDbEntityEarnOrders')
    ).SimpleDbEntityEarnOrders;
    const value = new SimpleDbEntityEarnOrders();
    Object.defineProperty(this, 'earnOrders', { value });
    return value;
  }

  get universalSearch() {
    const SimpleDbEntityUniversalSearch = (
      require('../entity/SimpleDbEntityUniversalSearch') as unknown as typeof import('../entity/SimpleDbEntityUniversalSearch')
    ).SimpleDbEntityUniversalSearch;
    const value = new SimpleDbEntityUniversalSearch();
    Object.defineProperty(this, 'universalSearch', { value });
    return value;
  }

  get customTokens() {
    const SimpleDbEntityCustomTokens = (
      require('../entity/SimpleDbEntityCustomTokens') as unknown as typeof import('../entity/SimpleDbEntityCustomTokens')
    ).SimpleDbEntityCustomTokens;
    const value = new SimpleDbEntityCustomTokens();
    Object.defineProperty(this, 'customTokens', { value });
    return value;
  }

  get customRpc() {
    const SimpleDbEntityCustomRpc = (
      require('../entity/SimpleDbEntityCustomRPC') as unknown as typeof import('../entity/SimpleDbEntityCustomRPC')
    ).SimpleDbEntityCustomRpc;
    const value = new SimpleDbEntityCustomRpc();
    Object.defineProperty(this, 'customRpc', { value });
    return value;
  }

  get customNetwork() {
    const SimpleDbEntityCustomNetwork = (
      require('../entity/SimpleDbEntityCustomNetwork') as unknown as typeof import('../entity/SimpleDbEntityCustomNetwork')
    ).SimpleDbEntityCustomNetwork;
    const value = new SimpleDbEntityCustomNetwork();
    Object.defineProperty(this, 'customNetwork', { value });
    return value;
  }

  get serverNetwork() {
    const SimpleDbEntityServerNetwork = (
      require('../entity/SimpleDbEntityServerNetwork') as unknown as typeof import('../entity/SimpleDbEntityServerNetwork')
    ).SimpleDbEntityServerNetwork;
    const value = new SimpleDbEntityServerNetwork();
    Object.defineProperty(this, 'serverNetwork', { value });
    return value;
  }

  get v4MigrationResult() {
    const SimpleDbEntityV4MigrationResult = (
      require('../entity/SimpleDbEntityV4MigrationResult') as unknown as typeof import('../entity/SimpleDbEntityV4MigrationResult')
    ).SimpleDbEntityV4MigrationResult;
    const value = new SimpleDbEntityV4MigrationResult();
    Object.defineProperty(this, 'v4MigrationResult', { value });
    return value;
  }

  get accountValue() {
    const SimpleDbEntityAccountValue = (
      require('../entity/SimpleDbEntityAccountValue') as unknown as typeof import('../entity/SimpleDbEntityAccountValue')
    ).SimpleDbEntityAccountValue;
    const value = new SimpleDbEntityAccountValue();
    Object.defineProperty(this, 'accountValue', { value });
    return value;
  }

  get legacyWalletNames() {
    const SimpleDbEntityLegacyWalletNames = (
      require('../entity/SimpleDbEntityLegacyWalletNames') as unknown as typeof import('../entity/SimpleDbEntityLegacyWalletNames')
    ).SimpleDbEntityLegacyWalletNames;
    const value = new SimpleDbEntityLegacyWalletNames();
    Object.defineProperty(this, 'legacyWalletNames', { value });
    return value;
  }

  get localNFTs() {
    const SimpleDbEntityLocalNFTs = (
      require('../entity/SimpleDbEntityLocalNFTs') as unknown as typeof import('../entity/SimpleDbEntityLocalNFTs')
    ).SimpleDbEntityLocalNFTs;
    const value = new SimpleDbEntityLocalNFTs();
    Object.defineProperty(this, 'localNFTs', { value });
    return value;
  }

  get babylonSync() {
    const SimpleDbEntityBabylonSync = (
      require('../entity/SimpleDbEntityBabylonSync') as unknown as typeof import('../entity/SimpleDbEntityBabylonSync')
    ).SimpleDbEntityBabylonSync;
    const value = new SimpleDbEntityBabylonSync();
    Object.defineProperty(this, 'babylonSync', { value });
    return value;
  }

  get appStatus() {
    const SimpleDbEntityAppStatus = (
      require('../entity/SimpleDbEntityAppStatus') as unknown as typeof import('../entity/SimpleDbEntityAppStatus')
    ).SimpleDbEntityAppStatus;
    const value = new SimpleDbEntityAppStatus();
    Object.defineProperty(this, 'appStatus', { value });
    return value;
  }

  get allNetworks() {
    const SimpleDbEntityAllNetworks = (
      require('../entity/SimpleDbEntityAllNetworks') as unknown as typeof import('../entity/SimpleDbEntityAllNetworks')
    ).SimpleDbEntityAllNetworks;
    const value = new SimpleDbEntityAllNetworks();
    Object.defineProperty(this, 'allNetworks', { value });
    return value;
  }

  get changeHistory() {
    const SimpleDbEntityChangeHistory = (
      require('../entity/SimpleDbEntityChangeHistory') as unknown as typeof import('../entity/SimpleDbEntityChangeHistory')
    ).SimpleDbEntityChangeHistory;
    const value = new SimpleDbEntityChangeHistory();
    Object.defineProperty(this, 'changeHistory', { value });
    return value;
  }

  get recentNetworks() {
    const SimpleDbEntityRecentNetworks = (
      require('../entity/SimpleDbEntityRecentNetworks') as unknown as typeof import('../entity/SimpleDbEntityRecentNetworks')
    ).SimpleDbEntityRecentNetworks;
    const value = new SimpleDbEntityRecentNetworks();
    Object.defineProperty(this, 'recentNetworks', { value });
    return value;
  }

  get addressInfo() {
    const SimpleDbEntityAddressInfo = (
      require('../entity/SimpleDbEntityAddressInfo') as unknown as typeof import('../entity/SimpleDbEntityAddressInfo')
    ).SimpleDbEntityAddressInfo;
    const value = new SimpleDbEntityAddressInfo();
    Object.defineProperty(this, 'addressInfo', { value });
    return value;
  }

  get recentRecipients() {
    const SimpleDbEntityRecentRecipients = (
      require('../entity/SimpleDbEntityRecentRecipients') as unknown as typeof import('../entity/SimpleDbEntityRecentRecipients')
    ).SimpleDbEntityRecentRecipients;
    const value = new SimpleDbEntityRecentRecipients();
    Object.defineProperty(this, 'recentRecipients', { value });
    return value;
  }

  get riskTokenManagement() {
    const SimpleDbEntityRiskTokenManagement = (
      require('../entity/SimpleDbEntityRiskTokenManagement') as unknown as typeof import('../entity/SimpleDbEntityRiskTokenManagement')
    ).SimpleDbEntityRiskTokenManagement;
    const value = new SimpleDbEntityRiskTokenManagement();
    Object.defineProperty(this, 'riskTokenManagement', { value });
    return value;
  }

  get walletBanner() {
    const SimpleDbEntityWalletBanner = (
      require('../entity/SimpleDbEntityWalletBanner') as unknown as typeof import('../entity/SimpleDbEntityWalletBanner')
    ).SimpleDbEntityWalletBanner;
    const value = new SimpleDbEntityWalletBanner();
    Object.defineProperty(this, 'walletBanner', { value });
    return value;
  }

  get perp() {
    const SimpleDbEntityPerp = (
      require('../entity/SimpleDbEntityPerp') as unknown as typeof import('../entity/SimpleDbEntityPerp')
    ).SimpleDbEntityPerp;
    const value = new SimpleDbEntityPerp();
    Object.defineProperty(this, 'perp', { value });
    return value;
  }

  get approval() {
    const SimpleDbEntityApproval = (
      require('../entity/SimpleDbEntityApproval') as unknown as typeof import('../entity/SimpleDbEntityApproval')
    ).SimpleDbEntityApproval;
    const value = new SimpleDbEntityApproval();
    Object.defineProperty(this, 'approval', { value });
    return value;
  }

  get aggregateToken() {
    const SimpleDbEntityAggregateToken = (
      require('../entity/SimpleDbEntityAggregateToken') as unknown as typeof import('../entity/SimpleDbEntityAggregateToken')
    ).SimpleDbEntityAggregateToken;
    const value = new SimpleDbEntityAggregateToken();
    Object.defineProperty(this, 'aggregateToken', { value });
    return value;
  }

  get chainResource() {
    const SimpleDbEntityChainResource = (
      require('../entity/SimpleDbEntityChainResource') as unknown as typeof import('../entity/SimpleDbEntityChainResource')
    ).SimpleDbEntityChainResource;
    const value = new SimpleDbEntityChainResource();
    Object.defineProperty(this, 'chainResource', { value });
    return value;
  }
}
