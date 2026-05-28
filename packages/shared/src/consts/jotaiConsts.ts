export const CONTEXT_ATOM_COLD_START_CACHE_KEYS = {
  accountWorthAtom: 'ctx:accountWorthAtom',
  lastConfirmedOverviewBalanceAtom: 'ctx:lastConfirmedOverviewBalanceAtom',
  overviewTokenCacheStateAtom: 'ctx:overviewTokenCacheStateAtom',
  overviewDeFiDataStateAtom: 'ctx:overviewDeFiDataStateAtom',
  walletTopBannersAtom: 'ctx:walletTopBannersAtom',
  selectedAccountsAtom: 'ctx:selectedAccountsAtom',
  accountSelectorStorageReadyAtom: 'ctx:accountSelectorStorageReadyAtom',
  activeAccountsAtom: 'ctx:activeAccountsAtom',
  renderedTokenListCacheAtom: 'ctx:renderedTokenListCacheAtom',
  perpsActiveTradeInstrumentAtom: 'ctx:perpsActiveTradeInstrumentAtom',
  perpsTokenSearchAliasesAtom: 'ctx:perpsTokenSearchAliasesAtom',
  perpsMaxBuilderFeeAtom: 'ctx:perpsMaxBuilderFeeAtom',
  perpsActiveAssetCtxColdCacheAtom: 'ctx:perpsActiveAssetCtxColdCacheAtom',
} as const;

export type IContextAtomColdStartCacheKey =
  (typeof CONTEXT_ATOM_COLD_START_CACHE_KEYS)[keyof typeof CONTEXT_ATOM_COLD_START_CACHE_KEYS];
