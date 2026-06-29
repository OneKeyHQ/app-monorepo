/**
 * TokenList cells — per-token, per-field granular state cells fed by BG frames (Phase-1 Slice 1 foundation).
 *
 * Barrel for the cells plumbing: the pure functions, wire types, the per-store
 * projection + lazy cell builders, the apply contract, the buildFrames pure
 * mapping, the stable `useTokenFiat` seam, and the producer hook.
 */
export {
  computeNonZeroIds,
  fiatEqual,
  isAgg,
  metaEqual,
  shallowEqualArrayOf,
  sumAggregateEntry,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
export type { IComputeNonZeroIdsParams } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
export type {
  IAggKey,
  IListStructure,
  INetworkId,
  IStructureSnapshot,
  ITokenKey,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
export * from './projection';
export * from './apply';
export {
  buildFrames,
  metaByKeyFromTokens,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/buildFrames';
export type {
  IBuildFramesInput,
  IBuildFramesPrev,
  IBuildFramesResult,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/buildFrames';
export * from './homeProjection';
export * from './seamGate';
export * from './coldStart';
export * from './useTokenFiat';
export * from './useTokenListCellsProducer';
export * from './useHomeTokenListOwnerKey';
export * from './useHomeTokenListSnapshot';
export * from './useAggregateSubTokenFiatMap';
