/**
 * TokenList cells — Phase-1 wire-payload types (spec §4.0).
 *
 * These are the authoritative shapes the producer emits and the apply layer
 * consumes. They are pure data (no React / store handles other than the
 * identity-check `storeData`) so the producer payload can be constructed and
 * fed to apply in node tests (spec §11.5).
 */
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

/** `$key` alias for readability — a token's stable list key. */
export type ITokenKey = string;

/**
 * Runtime value held by `listStructureAtom` inside the contextAtom store
 * (spec §3). Distinct from the over-the-wire `IStructureSnapshot`: this is the
 * applied, in-memory projection of ids + membership + owner/generation. Values
 * live in the per-key cells, NOT here (spec §7 "运行时拆/磁盘合").
 */
export interface IListStructure {
  orderedIds: string[];
  smallBalanceIds: string[];
  /** hideZero ids; Phase-1 dead-weight, Phase-2 consumer (spec §8#2). */
  nonZeroIds: string[];
  /**
   * STRICT funded set: ids whose balance > 0 ONLY (risk-excluded; aggregate-aware
   * = aggregate funded when its per-network sum > 0). DISTINCT from `nonZeroIds`,
   * which keeps zero-balance default/custom tokens via its keepDefault branches
   * (the hideZero VIEW filter). `fundedIds` is the correct `hasHoldingsNow`
   * signal — pure balance>0, NO keepDefault retention (full-delete PR-0 enabler).
   */
  fundedIds: string[];
  /** aggKey -> networkId[] — aggCell reads members from here (spec §3.1). */
  aggMembership: Record<string, string[]>;
  /** `${accountId}__${networkId}`. */
  ownerKey: string;
  /** monotonic, UI-produced in Phase-1 (spec §3, §4.1). */
  generation: number;
  /** §6: structure carries the small-balance fiat scalar (PR-0 enabler). */
  smallBalanceFiatValue: string;
  /**
   * Per-`$key` OWNED aggregate sub-token METADATA list (`{ tokens }`). Threaded
   * as structure-tier data (full-delete PR-7): it changes only with structure
   * (membership / sub-token swap), never on a price tick. The home cell-path
   * leaves (TokenIconView / TokenNameView / TokenActionsView / TokenListFooter)
   * read it from `listStructureAtom` instead of the legacy
   * `aggregateTokensListMapAtom`. It is metadata, not summed — no BigNumber work.
   */
  ownedAggregateTokenListMap: Record<IAggKey, { tokens: IAccountToken[] }>;
}
/** aggregate-token list-map key (e.g. `aggregate_...`). */
export type IAggKey = string;
export type INetworkId = string;

/**
 * Structure frame — emitted only when the structure changes (add/remove
 * token, reorder, owner switch, meta change). Pure price ticks do NOT emit a
 * structure frame (spec §4.1).
 */
export interface IStructureSnapshot {
  orderedIds: ITokenKey[];
  smallBalanceIds: ITokenKey[];
  nonZeroIds: ITokenKey[];
  /**
   * STRICT funded set (balance>0 only, agg-aware). DISTINCT from `nonZeroIds`
   * (which keeps keepDefault zero-balance tokens). PR-0 enabler — see
   * `IListStructure.fundedIds`.
   */
  fundedIds: ITokenKey[];
  metaPatch: Record<ITokenKey, IToken>;
  /** aggregate membership: aggKey -> the networkIds that compose it. */
  aggMembership: Record<IAggKey, INetworkId[]>;
  /** §6: structure must co-produce the small-balance fiat scalar. */
  smallBalanceFiatValue: string;
  /**
   * Per-`$key` OWNED aggregate sub-token METADATA list (`{ tokens }`). Carried
   * on the structure frame (full-delete PR-7) so the home cell-path leaves
   * source it from `listStructureAtom` rather than `aggregateTokensListMapAtom`.
   * Metadata only — never summed.
   */
  ownedAggregateTokenListMap: Record<IAggKey, { tokens: IAccountToken[] }>;
  /** identity check (NOT a string id) — see resolveCurrentStore. */
  storeData: IJotaiContextStoreData;
  ownerKey: string;
  generation: number;
}

/**
 * Valuation frame — emitted on every fetch round. Carries the FULL current fiat
 * map (a complete, idempotent snapshot), NOT a delta: this is deliberate so a
 * frame dropped by the lossy appEventBus self-heals on the next round. The
 * per-cell `fiatEqual` guard in `applyValuationFrame` is what makes it
 * effectively changed-only at the RENDER layer (no notify when a value is
 * unchanged), not at the wire layer. Aggregate tokens flow through the dedicated
 * `changedAggFiat` per-network channel (spec §4, §3.1), never through
 * `changedFiatById`.
 */
export interface IValuationFrame {
  changedFiatById: Record<ITokenKey, ITokenFiat>;
  changedAggFiat: Record<IAggKey, Record<INetworkId, ITokenFiat>>;
  storeData: IJotaiContextStoreData;
  ownerKey: string;
}
