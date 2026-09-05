import type { AsyncStorageStatic } from '@onekeyhq/shared/src/storage/appStorageTypes';

import { createLazyServiceProxy } from '../../../apis/lazyServiceProxy';

import {
  getSimpleDbEntityKey,
  getXpubOrAddressFromAccountKey,
} from './simpleDbFacadeCompatibility';

export class SimpleDb {
  // Lazy load entities using getters
  get prime() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@prime',
      loader: () =>
        import(
          /* webpackChunkName: "simpledb-startup-core" */ '../entity/SimpleDbEntityPrime'
        ).then(({ SimpleDbEntityPrime }) => new SimpleDbEntityPrime()),
    });
    Object.defineProperty(this, 'prime', { value });
    return value;
  }

  get primeTransfer() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@primeTransfer',
      loader: () =>
        import('../entity/SimpleDbEntityPrimeTransfer').then(
          ({ SimpleDbEntityPrimeTransfer }) =>
            new SimpleDbEntityPrimeTransfer(),
        ),
    });
    Object.defineProperty(this, 'primeTransfer', { value });
    return value;
  }

  get referralCode() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@referralCode',
      loader: () =>
        import('../entity/SimpleDbEntityReferralCode').then(
          ({ SimpleDbEntityReferralCode }) => new SimpleDbEntityReferralCode(),
        ),
    });
    Object.defineProperty(this, 'referralCode', { value });
    return value;
  }

  get browserTabs() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@browserTabs',
      loader: () =>
        import('../entity/SimpleDbEntityBrowserTabs').then(
          ({ SimpleDbEntityBrowserTabs }) => new SimpleDbEntityBrowserTabs(),
        ),
    });
    Object.defineProperty(this, 'browserTabs', { value });
    return value;
  }

  get browserBookmarks() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@browserBookmarks',
      loader: () =>
        import('../entity/SimpleDbEntityBrowserBookmarks').then(
          ({ SimpleDbEntityBrowserBookmarks }) =>
            new SimpleDbEntityBrowserBookmarks(),
        ),
    });
    Object.defineProperty(this, 'browserBookmarks', { value });
    return value;
  }

  get browserClosedTabs() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@browserClosedTabs',
      loader: () =>
        import('../entity/SimpleDbEntityBrowserClosedTabs').then(
          ({ SimpleDbEntityBrowserClosedTabs }) =>
            new SimpleDbEntityBrowserClosedTabs(),
        ),
    });
    Object.defineProperty(this, 'browserClosedTabs', { value });
    return value;
  }

  get browserRiskWhiteList() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@browserRiskWhiteList',
      loader: () =>
        import('../entity/SimpleDbEntityBrowserRiskWhiteList').then(
          ({ SimpleDbEntityBrowserRiskWhiteList }) =>
            new SimpleDbEntityBrowserRiskWhiteList(),
        ),
    });
    Object.defineProperty(this, 'browserRiskWhiteList', { value });
    return value;
  }

  get dappConnection() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@dappConnection',
      loader: () =>
        import('../entity/SimpleDbEntityDappConnection').then(
          ({ SimpleDbEntityDappConnection }) =>
            new SimpleDbEntityDappConnection(),
        ),
    });
    Object.defineProperty(this, 'dappConnection', { value });
    return value;
  }

  get browserHistory() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@browserHistory',
      loader: () =>
        import('../entity/SimpleDbEntityBrowserHistory').then(
          ({ SimpleDbEntityBrowserHistory }) =>
            new SimpleDbEntityBrowserHistory(),
        ),
    });
    Object.defineProperty(this, 'browserHistory', { value });
    return value;
  }

  get accountSelector() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@accountSelector',
      loader: () =>
        import(
          /* webpackChunkName: "simpledb-startup-core" */ '../entity/SimpleDbEntityAccountSelector'
        ).then(
          ({ SimpleDbEntityAccountSelector }) =>
            new SimpleDbEntityAccountSelector(),
        ),
    });
    Object.defineProperty(this, 'accountSelector', { value });
    return value;
  }

  get appCleanup() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@appCleanup',
      loader: () =>
        import('../entity/SimpleDbEntityAppCleanup').then(
          ({ SimpleDbEntityAppCleanup }) => new SimpleDbEntityAppCleanup(),
        ),
    });
    Object.defineProperty(this, 'appCleanup', { value });
    return value;
  }

  get swapNetworksSort() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@swapNetworksSort',
      loader: () =>
        import('../entity/SimpleDbEntitySwapNetworksSort').then(
          ({ SimpleDbEntitySwapNetworksSort }) =>
            new SimpleDbEntitySwapNetworksSort(),
        ),
    });
    Object.defineProperty(this, 'swapNetworksSort', { value });
    return value;
  }

  get swapHistory() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@swapHistory',
      loader: () =>
        import('../entity/SimpleDbEntitySwapHistory').then(
          ({ SimpleDbEntitySwapHistory }) => new SimpleDbEntitySwapHistory(),
        ),
    });
    Object.defineProperty(this, 'swapHistory', { value });
    return value;
  }

  get swapConfigs() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@swapConfigs',
      loader: () =>
        import('../entity/SimpleDbEntitySwapConfigs').then(
          ({ SimpleDbEntitySwapConfigs }) => new SimpleDbEntitySwapConfigs(),
        ),
    });
    Object.defineProperty(this, 'swapConfigs', { value });
    return value;
  }

  get swapProSelectToken() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@swapProSelectToken',
      loader: () =>
        import('../entity/SimpleDbEntitySwapProSelectToken').then(
          ({ SimpleDbEntitySwapProSelectToken }) =>
            new SimpleDbEntitySwapProSelectToken(),
        ),
    });
    Object.defineProperty(this, 'swapProSelectToken', { value });
    return value;
  }

  get localTokens() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@localTokens',
      loader: () =>
        import('../entity/SimpleDbEntityLocalTokens').then(
          ({ SimpleDbEntityLocalTokens }) => new SimpleDbEntityLocalTokens(),
        ),
    });
    Object.defineProperty(this, 'localTokens', { value });
    return value;
  }

  get addressBook() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@addressBook',
      loader: () =>
        import('../entity/SimpleDbEntityAddressBook').then(
          ({ SimpleDbEntityAddressBook }) => new SimpleDbEntityAddressBook(),
        ),
    });
    Object.defineProperty(this, 'addressBook', { value });
    return value;
  }

  get localHistory() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@localHistory',
      loader: () =>
        import('../entity/SimpleDbEntityLocalHistory').then(
          ({ SimpleDbEntityLocalHistory }) => new SimpleDbEntityLocalHistory(),
        ),
    });
    Object.defineProperty(this, 'localHistory', { value });
    return value;
  }

  get riskyTokens() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@riskyTokens',
      loader: () =>
        import('../entity/SimpleDbEntityRiskyTokens').then(
          ({ SimpleDbEntityRiskyTokens }) => new SimpleDbEntityRiskyTokens(),
        ),
    });
    Object.defineProperty(this, 'riskyTokens', { value });
    return value;
  }

  get defaultWalletSettings() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@defaultWalletSettings',
      loader: () =>
        import('../entity/SimpleDbEntityDefaultWalletSettings').then(
          ({ SimpleDbEntityDefaultWalletSettings }) =>
            new SimpleDbEntityDefaultWalletSettings(),
        ),
    });
    Object.defineProperty(this, 'defaultWalletSettings', { value });
    return value;
  }

  get networkSelector() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@networkSelector',
      loader: () =>
        import('../entity/SimpleDbEntityNetworkSelector').then(
          ({ SimpleDbEntityNetworkSelector }) =>
            new SimpleDbEntityNetworkSelector(),
        ),
    });
    Object.defineProperty(this, 'networkSelector', { value });
    return value;
  }

  get notificationSettings() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@notificationSettings',
      loader: () =>
        import('../entity/SimpleDbEntityNotificationSettings').then(
          ({ SimpleDbEntityNotificationSettings }) =>
            new SimpleDbEntityNotificationSettings(),
        ),
    });
    Object.defineProperty(this, 'notificationSettings', { value });
    return value;
  }

  get lightning() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@lightning',
      loader: () =>
        import('../entity/SimpleDbEntityLightning').then(
          ({ SimpleDbEntityLightning }) => new SimpleDbEntityLightning(),
        ),
    });
    Object.defineProperty(this, 'lightning', { value });
    return value;
  }

  get feeInfo() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@feeInfo',
      loader: () =>
        import('../entity/SimpleDbEntityFeeInfo').then(
          ({ SimpleDbEntityFeeInfo }) => new SimpleDbEntityFeeInfo(),
        ),
    });
    Object.defineProperty(this, 'feeInfo', { value });
    return value;
  }

  get marketWatchList() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@marketWatchList',
      loader: () =>
        import('../entity/SimpleDbEntityMarketWatchList').then(
          ({ SimpleDbEntityMarketWatchList }) =>
            new SimpleDbEntityMarketWatchList(),
        ),
    });
    Object.defineProperty(this, 'marketWatchList', { value });
    return value;
  }

  get marketPresetSettings() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@marketPresetSettings',
      loader: () =>
        import('../entity/SimpleDbEntityMarketPresetSettings').then(
          ({ SimpleDbEntityMarketPresetSettings }) =>
            new SimpleDbEntityMarketPresetSettings(),
        ),
    });
    Object.defineProperty(this, 'marketPresetSettings', { value });
    return value;
  }

  get marketWatchListV2() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@marketWatchListV2',
      loader: () =>
        import('../entity/SimpleDbEntityMarketWatchListV2').then(
          ({ SimpleDbEntityMarketWatchListV2 }) =>
            new SimpleDbEntityMarketWatchListV2(),
        ),
    });
    Object.defineProperty(this, 'marketWatchListV2', { value });
    return value;
  }

  get floatingIconDomainBlockList() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@floatingIconDomainBlockList',
      loader: () =>
        import('../entity/SimpleDbEntityFloatingIconDomainBlockList').then(
          ({ SimpleDbEntityFloatingIconDomainBlockList }) =>
            new SimpleDbEntityFloatingIconDomainBlockList(),
        ),
    });
    Object.defineProperty(this, 'floatingIconDomainBlockList', { value });
    return value;
  }

  get floatingIconSettings() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@floatingIconSettings',
      loader: () =>
        import('../entity/SimpleDbEntityFloatingIconSettings').then(
          ({ SimpleDbEntityFloatingIconSettings }) =>
            new SimpleDbEntityFloatingIconSettings(),
        ),
    });
    Object.defineProperty(this, 'floatingIconSettings', { value });
    return value;
  }

  get earn() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@earn',
      loader: () =>
        import('../entity/SimpleDbEntityEarn').then(
          ({ SimpleDbEntityEarn }) => new SimpleDbEntityEarn(),
        ),
    });
    Object.defineProperty(this, 'earn', { value });
    return value;
  }

  get earnExtra() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@earnExtra',
      loader: () =>
        import('../entity/SimpleDbEntityEarnExtra').then(
          ({ SimpleDbEntityEarnExtra }) => new SimpleDbEntityEarnExtra(),
        ),
    });
    Object.defineProperty(this, 'earnExtra', { value });
    return value;
  }

  get earnOrders() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@earnOrders',
      loader: () =>
        import('../entity/SimpleDbEntityEarnOrders').then(
          ({ SimpleDbEntityEarnOrders }) => new SimpleDbEntityEarnOrders(),
        ),
    });
    Object.defineProperty(this, 'earnOrders', { value });
    return value;
  }

  get universalSearch() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@universalSearch',
      loader: () =>
        import('../entity/SimpleDbEntityUniversalSearch').then(
          ({ SimpleDbEntityUniversalSearch }) =>
            new SimpleDbEntityUniversalSearch(),
        ),
    });
    Object.defineProperty(this, 'universalSearch', { value });
    return value;
  }

  get customTokens() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@customTokens',
      loader: () =>
        import('../entity/SimpleDbEntityCustomTokens').then(
          ({ SimpleDbEntityCustomTokens }) => new SimpleDbEntityCustomTokens(),
        ),
      createImmediateMembers: () => ({
        getXpubOrAddressFromAccountKey,
      }),
    });
    Object.defineProperty(this, 'customTokens', { value });
    return value;
  }

  get customRpc() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@customRpc',
      loader: () =>
        import('../entity/SimpleDbEntityCustomRPC').then(
          ({ SimpleDbEntityCustomRpc }) => new SimpleDbEntityCustomRpc(),
        ),
    });
    Object.defineProperty(this, 'customRpc', { value });
    return value;
  }

  get customNetwork() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@customNetwork',
      loader: () =>
        import(
          /* webpackChunkName: "simpledb-startup-core" */ '../entity/SimpleDbEntityCustomNetwork'
        ).then(
          ({ SimpleDbEntityCustomNetwork }) =>
            new SimpleDbEntityCustomNetwork(),
        ),
    });
    Object.defineProperty(this, 'customNetwork', { value });
    return value;
  }

  get serverNetwork() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@serverNetwork',
      loader: () =>
        import(
          /* webpackChunkName: "simpledb-startup-core" */ '../entity/SimpleDbEntityServerNetwork'
        ).then(
          ({ SimpleDbEntityServerNetwork }) =>
            new SimpleDbEntityServerNetwork(),
        ),
    });
    Object.defineProperty(this, 'serverNetwork', { value });
    return value;
  }

  get v4MigrationResult() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@v4MigrationResult',
      loader: () =>
        import('../entity/SimpleDbEntityV4MigrationResult').then(
          ({ SimpleDbEntityV4MigrationResult }) =>
            new SimpleDbEntityV4MigrationResult(),
        ),
    });
    Object.defineProperty(this, 'v4MigrationResult', { value });
    return value;
  }

  get accountValue() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@accountValue',
      loader: () =>
        import('../entity/SimpleDbEntityAccountValue').then(
          ({ SimpleDbEntityAccountValue }) => new SimpleDbEntityAccountValue(),
        ),
    });
    Object.defineProperty(this, 'accountValue', { value });
    return value;
  }

  get legacyWalletNames() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@legacyWalletNames',
      loader: () =>
        import('../entity/SimpleDbEntityLegacyWalletNames').then(
          ({ SimpleDbEntityLegacyWalletNames }) =>
            new SimpleDbEntityLegacyWalletNames(),
        ),
    });
    Object.defineProperty(this, 'legacyWalletNames', { value });
    return value;
  }

  get localNFTs() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@localNFTs',
      loader: () =>
        import('../entity/SimpleDbEntityLocalNFTs').then(
          ({ SimpleDbEntityLocalNFTs }) => new SimpleDbEntityLocalNFTs(),
        ),
    });
    Object.defineProperty(this, 'localNFTs', { value });
    return value;
  }

  get botWallet() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@botWallet',
      loader: () =>
        import('../entity/SimpleDbEntityBotWallet').then(
          ({ SimpleDbEntityBotWallet }) => new SimpleDbEntityBotWallet(),
        ),
    });
    Object.defineProperty(this, 'botWallet', { value });
    return value;
  }

  get babylonSync() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@babylonSync',
      loader: () =>
        import('../entity/SimpleDbEntityBabylonSync').then(
          ({ SimpleDbEntityBabylonSync }) => new SimpleDbEntityBabylonSync(),
        ),
    });
    Object.defineProperty(this, 'babylonSync', { value });
    return value;
  }

  get hardwarePortfolioSync() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@hardwarePortfolioSync',
      loader: () =>
        import('../entity/SimpleDbEntityHardwarePortfolioSync').then(
          ({ SimpleDbEntityHardwarePortfolioSync }) =>
            new SimpleDbEntityHardwarePortfolioSync(),
        ),
    });
    Object.defineProperty(this, 'hardwarePortfolioSync', { value });
    return value;
  }

  get appStatus() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@appStatus',
      loader: () =>
        import('../entity/SimpleDbEntityAppStatus').then(
          ({ SimpleDbEntityAppStatus }) => new SimpleDbEntityAppStatus(),
        ),
      createImmediateMembers: (loadEntity) => ({
        entityKey: getSimpleDbEntityKey('appStatus'),
        appStorage: {
          getItem: (
            ...args: Parameters<AsyncStorageStatic['getItem']>
          ): ReturnType<AsyncStorageStatic['getItem']> =>
            loadEntity().then((loadedEntity) =>
              loadedEntity.appStorage.getItem(...args),
            ),
        },
      }),
    });
    Object.defineProperty(this, 'appStatus', { value });
    return value;
  }

  get allNetworks() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@allNetworks',
      loader: () =>
        import('../entity/SimpleDbEntityAllNetworks').then(
          ({ SimpleDbEntityAllNetworks }) => new SimpleDbEntityAllNetworks(),
        ),
    });
    Object.defineProperty(this, 'allNetworks', { value });
    return value;
  }

  get changeHistory() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@changeHistory',
      loader: () =>
        import('../entity/SimpleDbEntityChangeHistory').then(
          ({ SimpleDbEntityChangeHistory }) =>
            new SimpleDbEntityChangeHistory(),
        ),
    });
    Object.defineProperty(this, 'changeHistory', { value });
    return value;
  }

  get recentNetworks() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@recentNetworks',
      loader: () =>
        import('../entity/SimpleDbEntityRecentNetworks').then(
          ({ SimpleDbEntityRecentNetworks }) =>
            new SimpleDbEntityRecentNetworks(),
        ),
    });
    Object.defineProperty(this, 'recentNetworks', { value });
    return value;
  }

  get addressRiskCheck() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@addressRiskCheck',
      loader: () =>
        import('../entity/SimpleDbEntityAddressRiskCheck').then(
          ({ SimpleDbEntityAddressRiskCheck }) =>
            new SimpleDbEntityAddressRiskCheck(),
        ),
    });
    Object.defineProperty(this, 'addressRiskCheck', { value });
    return value;
  }

  get addressInfo() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@addressInfo',
      loader: () =>
        import('../entity/SimpleDbEntityAddressInfo').then(
          ({ SimpleDbEntityAddressInfo }) => new SimpleDbEntityAddressInfo(),
        ),
    });
    Object.defineProperty(this, 'addressInfo', { value });
    return value;
  }

  get recentRecipients() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@recentRecipients',
      loader: () =>
        import('../entity/SimpleDbEntityRecentRecipientsImpl').then(
          ({ SimpleDbEntityRecentRecipients }) =>
            new SimpleDbEntityRecentRecipients(),
        ),
    });
    Object.defineProperty(this, 'recentRecipients', { value });
    return value;
  }

  get riskTokenManagement() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@riskTokenManagement',
      loader: () =>
        import('../entity/SimpleDbEntityRiskTokenManagement').then(
          ({ SimpleDbEntityRiskTokenManagement }) =>
            new SimpleDbEntityRiskTokenManagement(),
        ),
    });
    Object.defineProperty(this, 'riskTokenManagement', { value });
    return value;
  }

  get walletBanner() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@walletBanner',
      loader: () =>
        import('../entity/SimpleDbEntityWalletBanner').then(
          ({ SimpleDbEntityWalletBanner }) => new SimpleDbEntityWalletBanner(),
        ),
    });
    Object.defineProperty(this, 'walletBanner', { value });
    return value;
  }

  get perp() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@perp',
      loader: () =>
        import('../entity/SimpleDbEntityPerp').then(
          ({ SimpleDbEntityPerp }) => new SimpleDbEntityPerp(),
        ),
    });
    Object.defineProperty(this, 'perp', { value });
    return value;
  }

  get approval() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@approval',
      loader: () =>
        import('../entity/SimpleDbEntityApproval').then(
          ({ SimpleDbEntityApproval }) => new SimpleDbEntityApproval(),
        ),
    });
    Object.defineProperty(this, 'approval', { value });
    return value;
  }

  get aggregateToken() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@aggregateToken',
      loader: () =>
        import('../entity/SimpleDbEntityAggregateToken').then(
          ({ SimpleDbEntityAggregateToken }) =>
            new SimpleDbEntityAggregateToken(),
        ),
    });
    Object.defineProperty(this, 'aggregateToken', { value });
    return value;
  }

  get chainResource() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@chainResource',
      loader: () =>
        import('../entity/SimpleDbEntityChainResource').then(
          ({ SimpleDbEntityChainResource }) =>
            new SimpleDbEntityChainResource(),
        ),
    });
    Object.defineProperty(this, 'chainResource', { value });
    return value;
  }

  get receiveArrivalConfig() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@receiveArrivalConfig',
      loader: () =>
        import('../entity/SimpleDbEntityReceiveArrivalConfig').then(
          ({ SimpleDbEntityReceiveArrivalConfig }) =>
            new SimpleDbEntityReceiveArrivalConfig(),
        ),
    });
    Object.defineProperty(this, 'receiveArrivalConfig', { value });
    return value;
  }

  get btcFreshAddress() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@btcFreshAddress',
      loader: () =>
        import('../entity/SimpleDbEntityBTCFreshAddress').then(
          ({ SimpleDbEntityBTCFreshAddress }) =>
            new SimpleDbEntityBTCFreshAddress(),
        ),
    });
    Object.defineProperty(this, 'btcFreshAddress', { value });
    return value;
  }

  get btcFreshAddressMeta() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@btcFreshAddressMeta',
      loader: () =>
        import('../entity/SimpleDbEntityBTCFreshAddressMeta').then(
          ({ SimpleDbEntityBTCFreshAddressMeta }) =>
            new SimpleDbEntityBTCFreshAddressMeta(),
        ),
    });
    Object.defineProperty(this, 'btcFreshAddressMeta', { value });
    return value;
  }

  get walletStatus() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@walletStatus',
      loader: () =>
        import('../entity/SimpleDbEntityWalletStatus').then(
          ({ SimpleDbEntityWalletStatus }) => new SimpleDbEntityWalletStatus(),
        ),
    });
    Object.defineProperty(this, 'walletStatus', { value });
    return value;
  }

  get ipTable() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@ipTable',
      loader: () =>
        import('../entity/SimpleDbEntityIpTable').then(
          ({ SimpleDbEntityIpTable }) => new SimpleDbEntityIpTable(),
        ),
    });
    Object.defineProperty(this, 'ipTable', { value });
    return value;
  }

  get deFi() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@deFi',
      loader: () =>
        import('../entity/SimpleDbEntityDeFi').then(
          ({ SimpleDbEntityDeFi }) => new SimpleDbEntityDeFi(),
        ),
    });
    Object.defineProperty(this, 'deFi', { value });
    return value;
  }

  get marketTokenPreference() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@marketTokenPreference',
      loader: () =>
        import('../entity/SimpleDbEntityMarketTokenPreference').then(
          ({ SimpleDbEntityMarketTokenPreference }) =>
            new SimpleDbEntityMarketTokenPreference(),
        ),
    });
    Object.defineProperty(this, 'marketTokenPreference', { value });
    return value;
  }

  get rookieGuide() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@rookieGuide',
      loader: () =>
        import('../entity/SimpleDbEntityRookieGuide').then(
          ({ SimpleDbEntityRookieGuide }) => new SimpleDbEntityRookieGuide(),
        ),
    });
    Object.defineProperty(this, 'rookieGuide', { value });
    return value;
  }

  get walletConnectPay() {
    const value = createLazyServiceProxy({
      serviceName: 'simpleDb@walletConnectPay',
      loader: () =>
        import('../entity/SimpleDbEntityWalletConnectPay').then(
          ({ SimpleDbEntityWalletConnectPay }) =>
            new SimpleDbEntityWalletConnectPay(),
        ),
    });
    Object.defineProperty(this, 'walletConnectPay', { value });
    return value;
  }
}
