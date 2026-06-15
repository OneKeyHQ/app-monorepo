/**
 * TokenList SLC (Structured List Cells) — Phase-1 Slice 1 foundation.
 *
 * Barrel for the SLC plumbing: the pure functions, wire types, the per-store
 * projection + lazy cell builders, the apply contract, the buildFrames pure
 * mapping, the stable `useTokenFiat` seam, and the producer hook.
 */
export * from './pure';
export * from './types';
export * from './projection';
export * from './apply';
export * from './buildFrames';
export * from './coldStart';
export * from './useTokenFiat';
export * from './useTokenListSlcProducer';
