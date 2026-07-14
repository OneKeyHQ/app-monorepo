import { FastL2Book } from './FastL2Book';

describe('FastL2Book', () => {
  it('keeps source precision on snapshots and updates', () => {
    const book = new FastL2Book('ETH', { nSigFigs: 5, mantissa: 2 });
    book.apply({
      s: {
        coin: 'ETH',
        time: 1,
        levels: [
          [{ px: '100', sz: '1', n: 1 }],
          [{ px: '101', sz: '1', n: 1 }],
        ],
      },
    });

    expect(
      book.apply({ u: { c: 'ETH', t: 2, l: [[], []], r: [[], []] } }),
    ).toMatchObject({ nSigFigs: 5, mantissa: 2 });
  });

  it('merges an l2 delta into a snapshot without changing the book contract', () => {
    const book = new FastL2Book('BTC');

    expect(
      book.apply({
        s: {
          coin: 'BTC',
          time: 1,
          levels: [
            [
              { px: '100', sz: '1', n: 1 },
              { px: '99', sz: '2', n: 1 },
            ],
            [
              { px: '101', sz: '3', n: 1 },
              { px: '102', sz: '4', n: 1 },
            ],
          ],
        },
      }),
    ).toEqual({
      coin: 'BTC',
      time: 1,
      levels: [
        [
          { px: '100', sz: '1', n: 1 },
          { px: '99', sz: '2', n: 1 },
        ],
        [
          { px: '101', sz: '3', n: 1 },
          { px: '102', sz: '4', n: 1 },
        ],
      ],
    });

    expect(
      book.apply({
        u: {
          c: 'BTC',
          t: 2,
          l: [
            [
              { p: '100', s: '5' },
              { p: '98', s: '6' },
            ],
            [{ p: '101', s: '7' }],
          ],
          r: [[1], [1]],
        },
      }),
    ).toEqual({
      coin: 'BTC',
      time: 2,
      levels: [
        [
          { px: '100', sz: '5', n: 0 },
          { px: '98', sz: '6', n: 0 },
        ],
        [{ px: '101', sz: '7', n: 0 }],
      ],
    });
  });

  it('drops a delta received before the first snapshot', () => {
    const book = new FastL2Book('BTC');

    expect(
      book.apply({
        u: {
          c: 'BTC',
          t: 2,
          l: [[], []],
          r: [[], []],
        },
      }),
    ).toBeNull();
  });

  it('classifies frames from a previous target as stale', () => {
    const book = new FastL2Book('ETH');

    expect(() =>
      book.apply({
        u: {
          c: 'BTC',
          t: 2,
          l: [[], []],
          r: [[], []],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'stale_target',
      }),
    );
  });

  it('merges a compressed delta after the first snapshot', () => {
    const book = new FastL2Book('BTC');
    book.apply({
      s: {
        coin: 'BTC',
        time: 1,
        levels: [[{ px: '100', sz: '1', n: 1 }], []],
      },
    });

    expect(
      book.apply({
        c: 'q1ZKVrJScgpxVtJRKlGyMtJRylGyio6uVipQslIyNDBQ0lEqVrJSMlWqjdWJjo3VUSoCSYPZtQA=',
      }),
    ).toEqual({
      coin: 'BTC',
      time: 2,
      levels: [[{ px: '100', sz: '5', n: 0 }], []],
    });
  });

  it('rejects removal indexes outside the current book', () => {
    const book = new FastL2Book('BTC');
    book.apply({
      s: {
        coin: 'BTC',
        time: 1,
        levels: [[{ px: '100', sz: '1', n: 1 }], []],
      },
    });

    expect(() =>
      book.apply({
        u: {
          c: 'BTC',
          t: 2,
          l: [[], []],
          r: [[1], []],
        },
      }),
    ).toThrow('Fast L2 book: Invalid L2 removal index');
  });
});
