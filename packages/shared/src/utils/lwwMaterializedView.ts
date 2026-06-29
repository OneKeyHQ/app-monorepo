/**
 * A generic **Last-Write-Wins (LWW) map materialized view** for aggregating N
 * independent per-source async results into one list, used by the all-networks
 * token list and reusable for other per-(account, network) aggregations
 * (NFT / DeFi / history).
 *
 * It composes a few established patterns rather than inventing anything new:
 *  - **LWW-Map (CRDT-style) keyed cache**: one entry per key; a write wins by
 *    MAX generation, so a slow earlier-run response that arrives late can never
 *    clobber a newer one (the out-of-order/stale-write guard — "I1").
 *  - **stale-while-revalidate floor**: `seedFloor` pre-fills entries from local
 *    cache so the view is non-empty immediately; live results then replace them.
 *  - **intersection-based eviction (tombstone-free)**: `materialize(enabledKeys)`
 *    returns only entries whose key is still in the caller's authoritative
 *    enabled-key set, so removed/disabled sources are dropped without needing
 *    delete tombstones, while still-enabled-but-unsettled sources keep their
 *    floor (never shrinks below cache) — "I2".
 *  - **full-overwrite / floor-until-settled**: each key holds exactly ONE round
 *    (the latest), so a live result fully replaces its key (a sold/zeroed item
 *    drops) and a later floor seed cannot resurrect a value already written live.
 *
 * It deliberately does NOT know how to fetch a source, merge/sort items, or
 * classify a structure-vs-valuation delta — those are domain concerns the caller
 * supplies (e.g. the token list injects `buildMergedAllNetworkSnapshot` as the
 * merge and feeds the result to the bg view-model which does the IVM diffing).
 */
interface ILwwEntry<TRound> {
  round: TRound;
  generation: number;
  /** true once written by a live result (vs a cache-floor seed). */
  live: boolean;
}

export class LwwMaterializedView<TRound> {
  private readonly entries = new Map<string, ILwwEntry<TRound>>();

  private write(
    key: string,
    round: TRound,
    generation: number,
    live: boolean,
  ): boolean {
    const existing = this.entries.get(key);
    if (existing) {
      // I1 (LWW by max generation): a strictly-older run's write is stale — drop
      // it so a slow earlier response can't overwrite a newer one.
      if (generation < existing.generation) {
        return false;
      }
      // floor-until-settled: within the SAME generation a live result wins, and
      // a floor seed must never overwrite an already-settled live value (no
      // resurrection of a removed/zeroed item from the cache floor).
      if (generation === existing.generation && existing.live && !live) {
        return false;
      }
    }
    this.entries.set(key, { round, generation, live });
    return true;
  }

  /** Seed a key from the local cache floor (SWR). Returns whether it was applied. */
  seedFloor(key: string, round: TRound, generation: number): boolean {
    return this.write(key, round, generation, false);
  }

  /** Apply a live per-source result (LWW, full-overwrite). Returns whether it was applied. */
  ingest(key: string, round: TRound, generation: number): boolean {
    return this.write(key, round, generation, true);
  }

  /**
   * The materialized view: every entry whose key is still in `enabledKeys`
   * (intersection-evict). Caller then merges these rounds into the final list.
   */
  materialize(enabledKeys: Set<string>): TRound[] {
    const out: TRound[] = [];
    for (const [key, entry] of this.entries) {
      if (enabledKeys.has(key)) {
        out.push(entry.round);
      }
    }
    return out;
  }

  clear(): void {
    this.entries.clear();
  }
}
