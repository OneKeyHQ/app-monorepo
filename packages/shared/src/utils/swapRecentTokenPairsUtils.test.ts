import { capRecentTokenPairsPreservingOrder } from './swapRecentTokenPairsUtils';

function singleChain(id: string) {
  return {
    id,
    fromToken: { networkId: 'evm--1' },
    toToken: { networkId: 'evm--1' },
  };
}

function crossChain(id: string) {
  return {
    id,
    fromToken: { networkId: 'evm--1' },
    toToken: { networkId: 'evm--56' },
  };
}

describe('capRecentTokenPairsPreservingOrder', () => {
  it('keeps the global most-recent-first order across types', () => {
    const pairs = [
      crossChain('c1'),
      singleChain('s1'),
      crossChain('c2'),
      singleChain('s2'),
    ];
    expect(capRecentTokenPairsPreservingOrder(pairs).map((p) => p.id)).toEqual([
      'c1',
      's1',
      'c2',
      's2',
    ]);
  });

  it('caps each bucket independently while preserving order', () => {
    const pairs = [
      ...Array.from({ length: 3 }, (_, i) => singleChain(`s${i}`)),
      ...Array.from({ length: 3 }, (_, i) => crossChain(`c${i}`)),
    ];
    const result = capRecentTokenPairsPreservingOrder(pairs, 2);
    expect(result.map((p) => p.id)).toEqual(['s0', 's1', 'c0', 'c1']);
  });

  it('drops only the oldest entries of an over-cap bucket', () => {
    const pairs = [
      crossChain('newest-cross'),
      ...Array.from({ length: 10 }, (_, i) => singleChain(`s${i}`)),
      crossChain('old-cross'),
      singleChain('overflow-single'),
    ];
    const result = capRecentTokenPairsPreservingOrder(pairs, 10);
    const ids = result.map((p) => p.id);
    // The just-traded cross-chain pair stays at the head.
    expect(ids[0]).toBe('newest-cross');
    // Cross bucket is under its cap, so the older cross entry survives too.
    expect(ids).toContain('old-cross');
    // The 11th single-chain entry is the one that falls off.
    expect(ids).not.toContain('overflow-single');
    expect(ids.filter((id) => id.startsWith('s'))).toHaveLength(10);
  });

  it('a top-10 display slice mixes types by pure recency', () => {
    // 8 singles then 2 crosses traded most recently (head of the list).
    const pairs = [
      crossChain('c-newest'),
      crossChain('c-2nd'),
      ...Array.from({ length: 12 }, (_, i) => singleChain(`s${i}`)),
    ];
    const stored = capRecentTokenPairsPreservingOrder(pairs, 10);
    const displayed = stored.slice(0, 10).map((p) => p.id);
    expect(displayed).toEqual([
      'c-newest',
      'c-2nd',
      ...Array.from({ length: 8 }, (_, i) => `s${i}`),
    ]);
  });
});
