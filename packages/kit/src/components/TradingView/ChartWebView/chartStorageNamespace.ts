// storageNamespace for a unified chart host: isolates each consumer's chart
// settings. Market and Perps are the per-domain defaults; SwapKline is the Swap
// K-line modal's own isolated bucket (it overrides the default via
// params.storageNamespace). Single source of truth for every namespace value.
//
// ⚠️ Kept in a DEPENDENCY-FREE leaf module on purpose: this enum is read at
// module-init time (e.g. SwapKLineContent's top-level namespace const), so it
// must never be co-located with modules that re-export runtime values (e.g.
// constants.ts re-exports the kit-bg atoms barrel). Importing it from such a
// module pulls that barrel into the importer's init graph and the enum binding
// ends up read before initialization (Hermes: "Property
// 'EChartUnifiedStorageNamespace' doesn't exist"). A leaf module with no imports
// cannot participate in that cycle.
export enum EChartUnifiedStorageNamespace {
  Market = 'market',
  Perps = 'perps',
  SwapKline = 'swap-kline',
}
