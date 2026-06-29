/**
 * reorderNetworksByCachePriority (L3) — pure, stable partition that floats
 * cache-non-empty (likely-funded) networks to the front of the all-network
 * fan-out so the first concurrency wave fetches the user's real holdings first.
 * Must be a pure reordering: no item dropped/duplicated, input not mutated, and
 * a no-op when there is nothing to prioritize.
 */
import { reorderNetworksByCachePriority } from './reorderNetworksByCachePriority';

describe('reorderNetworksByCachePriority', () => {
  const items = [
    { networkId: 'a' },
    { networkId: 'b' },
    { networkId: 'c' },
    { networkId: 'd' },
  ];

  it('floats priority networks to the front, preserving order within each group', () => {
    const out = reorderNetworksByCachePriority(items, new Set(['c', 'a']));
    expect(out.map((i) => i.networkId)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('returns the original order when the priority set is empty', () => {
    const out = reorderNetworksByCachePriority(items, new Set<string>());
    expect(out.map((i) => i.networkId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('treats items without a networkId as non-priority', () => {
    const out = reorderNetworksByCachePriority(
      [{ networkId: 'a' }, {}, { networkId: 'b' }],
      new Set(['b']),
    );
    expect(out.map((i) => i.networkId)).toEqual(['b', 'a', undefined]);
  });

  it('does not drop, duplicate, or mutate', () => {
    const input = [...items];
    const out = reorderNetworksByCachePriority(input, new Set(['b']));
    expect(out).toHaveLength(items.length);
    expect(input.map((i) => i.networkId)).toEqual(['a', 'b', 'c', 'd']);
  });
});
