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
  swapStockTokenIdentity: 'swapStockTokenIdentity',
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

/**
 * The namespaces the background runtime writes, and therefore owns.
 *
 * Everything else belongs to a UI hook. A wipe performed by the UI runtime
 * leaves these alone: they hold market data keyed by coin rather than by any
 * wallet, and clearing a file bg is writing would put two writers on it.
 */
export const BG_OWNED_SWR_NAMESPACES: readonly ISwrCacheNamespace[] = [
  NS.perpsL2BookSnapshot,
];
export const prefixOf = (namespace: ISwrCacheNamespace) => `${namespace}:`;
