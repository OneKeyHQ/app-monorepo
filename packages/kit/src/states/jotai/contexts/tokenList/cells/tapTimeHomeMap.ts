/**
 * TokenList cells — tap-time home `tokenMap` reconstruction (full-delete PR-7).
 *
 * The Home `handleOnPressToken` used to feed the TokenDetails route a `tokenMap`
 * sourced from the now-deleted `tokenListMapAtom` (the FULL merged home
 * `$key -> ITokenFiat` map across ALL networks). TokenDetails uses that map to
 * (a) sort aggregate sub-tokens by fiat (`sortTokensCommon`) and (b) seed
 * instant balances (`batchUpdateTokenDetails`). A network-scoped read MISSES the
 * other-network aggregate sub-tokens, so they sort as 0 and get no seed.
 *
 * This module rebuilds the SAME full merged map from the live per-store cells
 * cells over the structure ids at tap time (same cell-reconstruction pattern as
 * `TokenListFooter` in PR-4):
 *   - every normal id (orderedIds ∪ smallBalanceIds) -> its `cell` fiat, keyed
 *     by the id itself;
 *   - every aggregate id -> its derived `aggCell` fiat (the flattened aggregate
 *     row), keyed by the aggregate `$key`, PLUS each owned sub-token's
 *     per-network fiat read from the `subcell` for the sub-token's `networkId`,
 *     keyed by the SUB-TOKEN's own `$key`. The sub-token `$key`s are exactly the
 *     keys TokenDetails rebuilds (`buildTokenListMapKey`), so the sort + seed
 *     resolve correctly across all home networks.
 *
 * Pure: no jotai/React/native module globals. The cell reads are injected as
 * callbacks so this is a clean testable seam.
 */
import type { ITokenKey } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

/** The structure inputs this reconstruction needs (subset of `IListStructure`). */
export interface ITapTimeStructure {
  orderedIds: ITokenKey[];
  smallBalanceIds: ITokenKey[];
  aggMembership: Record<string, string[]>;
  ownedAggregateTokenListMap: Record<string, { tokens: IAccountToken[] }>;
}

/** Injected cell reads (bound to the live store by the caller; pure in tests). */
export interface ITapTimeReaders {
  /** normal-token meta cell for a `$key` (drives the isAgg check). */
  readMeta: (key: ITokenKey) => IToken | undefined;
  /** normal-token fiat cell for a `$key`. */
  readCell: (key: ITokenKey) => ITokenFiat | undefined;
  /** derived aggregate fiat cell for an aggregate `$key`. */
  readAggCell: (aggKey: string) => ITokenFiat | undefined;
  /** aggregate per-network sub-cell fiat for (aggKey, networkId). */
  readSubCell: (aggKey: string, networkId: string) => ITokenFiat | undefined;
  /** aggregate identity check — same predicate the apply/footer paths use. */
  isAgg: (key: string, metaOf?: IToken) => boolean;
}

/**
 * Reconstruct the FULL merged home `$key -> ITokenFiat` map from the live cells,
 * spanning ALL home networks. This is the tap-time replacement for the deleted
 * `tokenListMapAtom` that TokenDetails consumes as its `tokenMap`.
 */
export function buildTapTimeHomeTokenMap(
  structure: ITapTimeStructure,
  readers: ITapTimeReaders,
): Record<string, ITokenFiat> {
  const map: Record<string, ITokenFiat> = {};

  const allIds = [...structure.orderedIds, ...structure.smallBalanceIds];
  for (const id of allIds) {
    if (readers.isAgg(id, readers.readMeta(id))) {
      // The flattened aggregate row itself (keyed by the aggregate `$key`).
      const aggFiat = readers.readAggCell(id);
      if (aggFiat) {
        map[id] = aggFiat;
      }
      // Each owned sub-token's per-network fiat, keyed by the SUB-TOKEN `$key`
      // (the key TokenDetails rebuilds for its sort + seed). One sub-token per
      // network per aggregate, so the network -> sub-cell join is exact.
      const subTokens = structure.ownedAggregateTokenListMap[id]?.tokens ?? [];
      for (const subToken of subTokens) {
        const networkId = subToken.networkId;
        if (networkId) {
          const subFiat = readers.readSubCell(id, networkId);
          if (subFiat) {
            map[subToken.$key] = subFiat;
          }
        }
      }
    } else {
      const fiat = readers.readCell(id);
      if (fiat) {
        map[id] = fiat;
      }
    }
  }

  return map;
}
