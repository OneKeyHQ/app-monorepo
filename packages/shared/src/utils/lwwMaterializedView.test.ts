/**
 * LwwMaterializedView — tests for the generic core behind the all-networks
 * progressive token list (and reusable for other per-(account,network)
 * aggregations). It is a Last-Write-Wins map keyed by an opaque string, whose
 * `materialize(enabledKeys)` is the intersection-evicted view. The three
 * invariants under test mirror the named patterns:
 *  - I1 generation guard: a stale (older-generation) write must not clobber a
 *    newer one (LWW by max generation, not by arrival order).
 *  - I2 intersection-evict: keys not in the current enabled set are dropped
 *    from the view (removed/disabled networks evicted; tombstone-free).
 *  - floor-until-settled / full-overwrite: a live write fully REPLACES a key's
 *    round (a key holds exactly one round — the latest), and once a key is
 *    written live, a later floor seed cannot resurrect the old value.
 */
import { LwwMaterializedView } from './lwwMaterializedView';

type TRound = { id: string; v: number };

describe('LwwMaterializedView', () => {
  it('materialize returns only entries whose key is in the enabled set', () => {
    const view = new LwwMaterializedView<TRound>();
    view.seedFloor('a', { id: 'a', v: 1 }, 1);
    view.seedFloor('b', { id: 'b', v: 1 }, 1);
    view.seedFloor('c', { id: 'c', v: 1 }, 1);

    const out = view.materialize(new Set(['a', 'c']));
    expect(out.map((r) => r.id).toSorted()).toEqual(['a', 'c']);
  });

  it('I1: rejects a write whose generation is older than the key current generation', () => {
    const view = new LwwMaterializedView<TRound>();
    view.ingest('a', { id: 'a', v: 2 }, 2); // newer run wrote first (arrived first)
    const accepted = view.ingest('a', { id: 'a', v: 1 }, 1); // stale run lands late
    expect(accepted).toBe(false);
    expect(view.materialize(new Set(['a']))[0].v).toBe(2);
  });

  it('I1: accepts a newer-generation write', () => {
    const view = new LwwMaterializedView<TRound>();
    view.ingest('a', { id: 'a', v: 1 }, 1);
    const accepted = view.ingest('a', { id: 'a', v: 2 }, 2);
    expect(accepted).toBe(true);
    expect(view.materialize(new Set(['a']))[0].v).toBe(2);
  });

  it('live ingest replaces a floor at the same generation (floor → live)', () => {
    const view = new LwwMaterializedView<TRound>();
    view.seedFloor('a', { id: 'a', v: 1 }, 5);
    const accepted = view.ingest('a', { id: 'a', v: 2 }, 5); // same run, live
    expect(accepted).toBe(true);
    expect(view.materialize(new Set(['a']))[0].v).toBe(2);
  });

  it('floor-until-settled: a floor seed cannot overwrite a settled live value at the same generation', () => {
    const view = new LwwMaterializedView<TRound>();
    view.ingest('a', { id: 'a', v: 2 }, 5); // live first
    const accepted = view.seedFloor('a', { id: 'a', v: 1 }, 5); // floor must not resurrect
    expect(accepted).toBe(false);
    expect(view.materialize(new Set(['a']))[0].v).toBe(2);
  });

  it('full-overwrite: a key holds exactly one round (the latest), not a union', () => {
    const view = new LwwMaterializedView<TRound>();
    view.ingest('a', { id: 'a', v: 1 }, 1);
    view.ingest('a', { id: 'a', v: 2 }, 2);
    const out = view.materialize(new Set(['a']));
    expect(out).toHaveLength(1);
    expect(out[0].v).toBe(2);
  });

  it('clear empties the view', () => {
    const view = new LwwMaterializedView<TRound>();
    view.seedFloor('a', { id: 'a', v: 1 }, 1);
    view.clear();
    expect(view.materialize(new Set(['a']))).toHaveLength(0);
  });
});
