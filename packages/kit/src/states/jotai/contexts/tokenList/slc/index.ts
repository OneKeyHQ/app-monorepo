/**
 * TokenList SLC (Structured List Cells) — Phase-1 Slice 1 foundation.
 *
 * Barrel for the SLC plumbing: the pure functions, wire types, the per-store
 * projection + lazy cell builders, the apply contract, the buildFrames pure
 * mapping, the stable `useTokenFiat` seam, and the producer hook.
 */
export {
  computeNonZeroIds,
  fiatEqual,
  isAgg,
  metaEqual,
  shallowEqualArrayOf,
  sortKeyFor,
  sumAggregateEntry,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/pure';
export type { IComputeNonZeroIdsParams } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/pure';
export type {
  IAggKey,
  IListStructure,
  INetworkId,
  IStructureSnapshot,
  ITokenKey,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/types';
export * from './projection';
export * from './apply';
export {
  buildFrames,
  metaByKeyFromTokens,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/buildFrames';
export type {
  IBuildFramesInput,
  IBuildFramesPrev,
  IBuildFramesResult,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/buildFrames';
export * from './homeProjection';
export * from './seamGate';
export * from './coldStart';
export * from './useTokenFiat';
export * from './useTokenListSlcProducer';
export * from './useHomeTokenListSnapshot';
export * from './useAggregateSubTokenFiatMap';
