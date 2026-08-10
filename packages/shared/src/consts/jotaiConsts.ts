export const CONTEXT_ATOM_COLD_START_CACHE_KEYS = {
  accountWorthAtom: 'ctx:accountWorthAtom',
  lastConfirmedOverviewBalanceAtom: 'ctx:lastConfirmedOverviewBalanceAtom',
  overviewTokenCacheStateAtom: 'ctx:overviewTokenCacheStateAtom',
  overviewDeFiDataStateAtom: 'ctx:overviewDeFiDataStateAtom',
  walletTopBannersAtom: 'ctx:walletTopBannersAtom',
  selectedAccountsAtom: 'ctx:selectedAccountsAtom',
  accountSelectorUpdateMetaAtom: 'ctx:accountSelectorUpdateMetaAtom',
  accountSelectorStorageReadyAtom: 'ctx:accountSelectorStorageReadyAtom',
  activeAccountsAtom: 'ctx:activeAccountsAtom',
  renderedTokenListCacheAtom: 'ctx:renderedTokenListCacheAtom',
  // TokenList cells slim cold-start bundle (spec §2, §7). Physically distinct
  // from `renderedTokenListCacheAtom` so the new slim format and the old
  // rendered-list format never ping-pong into the same MMKV/IDB slot.
  tokenListSlimColdCacheAtom: 'ctx:tokenListSlimColdCache',
  perpsActiveTradeInstrumentAtom: 'ctx:perpsActiveTradeInstrumentAtom',
  perpsTokenSearchAliasesAtom: 'ctx:perpsTokenSearchAliasesAtom',
  perpsMaxBuilderFeeAtom: 'ctx:perpsMaxBuilderFeeAtom',
  perpsActiveAssetCtxColdCacheAtom: 'ctx:perpsActiveAssetCtxColdCacheAtom',
  perpsL2BookColdCacheAtom: 'ctx:perpsL2BookColdCacheAtom',
  perpsActivePositionAtom: 'ctx:perpsActivePositionAtom',
  perpsActiveOpenOrdersAtom: 'ctx:perpsActiveOpenOrdersAtom',
  swapTipsStateAtom: 'ctx:swapTipsStateAtom',
  swapTypeSwitchAtom: 'ctx:swapTypeSwitchAtom',
  swapSelectFromTokenAtom: 'ctx:swapSelectFromTokenAtom',
  swapSelectToTokenAtom: 'ctx:swapSelectToTokenAtom',
  swapSelectedTokensColdStartContextAtom:
    'ctx:swapSelectedTokensColdStartContextAtom',
  swapStockSelectedTokenAtom: 'ctx:swapStockSelectedTokenAtom',
  swapStockPayTokenPreferenceAtom: 'ctx:swapStockPayTokenPreferenceAtom',
  swapProPositionsCacheAtom: 'ctx:swapProPositionsCacheAtom',
} as const;

export const PERPS_CONTEXT_ATOM_COLD_START_CACHE_KEYS = [
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsTokenSearchAliasesAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsMaxBuilderFeeAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveAssetCtxColdCacheAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsL2BookColdCacheAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom,
] as const;

export type IContextAtomColdStartCacheKey =
  (typeof CONTEXT_ATOM_COLD_START_CACHE_KEYS)[keyof typeof CONTEXT_ATOM_COLD_START_CACHE_KEYS];
