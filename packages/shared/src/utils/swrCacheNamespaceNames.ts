/**
 * The namespace of every SWR cache key, split out from `swrCacheUtils` so the
 * storage layer can name its namespaces without importing the cache itself.
 */
// Leading segment of every key produced by the matching swrKeys.X(...).
// Pair with `swrCacheUtils.removeByPrefix(prefixOf(namespace))` to
// invalidate a whole namespace at once.
const NS = {
  allNetworksCompatible: 'allNetCompat',
  unifiedNetworkSelectorMeta: 'unsMeta',
  unifiedNetworkSelectorValues: 'unsValues',
  networkContentData: 'netContent',
  recentNetworks: 'recentNets',
  walletListSideBar: 'walletList',
  accountSelectorList: 'accSelList',
  accountSelectorValues: 'accSelValues',
  discoveryHomePageData: 'disHomePage',
  discoveryHomeBookmarks: 'disHomeBookmarks',
  perpsOrderBookTickOptions: 'perpsOrderBookTicks',
  perpsL2BookSnapshot: 'perpsL2Book',
  historyTxDetail: 'historyTxDetail',
  marketHomeBanners: 'marketHomeBanners',
  marketHomeConfig: 'marketHomeConfig',
  marketHomeStocks: 'marketHomeStocks',
  marketHomeTokenList: 'marketHomeTokenList',
  marketStockDetail: 'marketStockDetail',
  marketStockTokenVariants: 'marketStockVariants',
  marketTokenDetail: 'marketTokenDetail',
  marketTokenSecurity: 'marketTokenSecurity',
  tokenSelectorView: 'tokenSelectorView',
  specifiedTokenSelectorView: 'specifiedTokenSelectorView',
  swapHistoryPreviewList: 'swapHistoryPreviewList',
  swapStockChart: 'swapStockChart',
  swapStockTokenDetail: 'swapStockTokenDetail',
  swapStockSpeedConfig: 'swapStockSpeedConfig',
  swapStockPayTokenDetails: 'swapStockPayTokenDetails',
  borrowMarkets: 'borrowMarkets',
  borrowReserves: 'borrowReserves',
  borrowHealthFactor: 'borrowHealthFactor',
  borrowRewards: 'borrowRewards',
  borrowEModeStatus: 'borrowEModeStatus',
  earnAccount: 'earnAccount',
  earnProtocolDetail: 'earnProtocolDetail',
  fiatCryptoTokenList: 'fiatCryptoTokenList',
  fiatCryptoNetworkSupport: 'fiatCryptoNetSupport',
  bulkSendAddressesInputSeed: 'bulkSendSeed',
  bulkCopyAddressesWallets: 'bulkCopyWallets',
  bulkCopyAddressesNetworkIds: 'bulkCopyNetIds',
  bulkCopyAddressesAccounts: 'bulkCopyAccounts',
  chainSelectorInputNetworks: 'chainSelNets',
  homeWalletTabSupport: 'homeWalletTabs',
} as const;
export type ISwrCacheNamespace = (typeof NS)[keyof typeof NS];
export const swrCacheNamespaces = NS;
export const prefixOf = (namespace: ISwrCacheNamespace) => `${namespace}:`;
