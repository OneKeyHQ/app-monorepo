import { isContentEqual } from './useContentStable';

describe('isContentEqual', () => {
  it('tells Maps apart by their entries', () => {
    const one = new Map([['usdc', { amount: '1' }]]);
    expect(isContentEqual(new Map(), one)).toBe(false);
    expect(isContentEqual(one, new Map([['usdc', { amount: '2' }]]))).toBe(
      false,
    );
    expect(isContentEqual(one, new Map([['usdc', { amount: '1' }]]))).toBe(
      true,
    );
  });

  it('sees into Maps inside objects, and into Sets', () => {
    expect(
      isContentEqual(
        { byToken: new Map([['usdc', 1]]) },
        { byToken: new Map() },
      ),
    ).toBe(false);
    expect(isContentEqual(new Set(['a']), new Set(['b']))).toBe(false);
    expect(isContentEqual(new Set(['a']), new Set(['a']))).toBe(true);
    expect(isContentEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
  });
});
