import type { IBook } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  getDepthBookTarget,
  getFinerCoveringBookTarget,
  getTrueDepthMidPrice,
  shouldWidenDepthBook,
} from './perpDepthBook';

describe('the independent depth book target', () => {
  it.each([
    [59_797.5, 5, { nSigFigs: 4, mantissa: null }, 10],
    [1679.25, 4, { nSigFigs: 5, mantissa: 5 }, 0.5],
    [68.9055, 2, { nSigFigs: 4, mantissa: null }, 0.01],
  ] as const)(
    'estimates a covering tick at %s',
    (price, szDecimals, options, step) => {
      expect(
        getDepthBookTarget({ price, szDecimals, isSpot: false }),
      ).toMatchObject({
        options,
        step,
      });
    },
  );

  const prices = (first: number, step: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      px: String(first + step * index),
      sz: '1',
      n: 1,
    }));

  it('keeps a full BTC $10 book when the BBO arrives ahead of it', () => {
    const book: IBook = {
      coin: 'BTC',
      time: 1,
      nSigFigs: 4,
      mantissa: null,
      levels: [prices(59_990, -10, 20), prices(60_010, 10, 20)],
    };
    expect(shouldWidenDepthBook(book, 60_000)).toBe(false);
    expect(shouldWidenDepthBook(book, 60_220)).toBe(false);
    expect(shouldWidenDepthBook(book, 59_780)).toBe(false);
  });

  it('reuses a verified finer live book and widens only a full two-sided book that falls short', () => {
    const raw = {
      coin: 'BTC',
      time: 1,
      nSigFigs: null,
      mantissa: null,
      levels: [prices(59_990, -10, 20), prices(60_010, 10, 20)],
    } satisfies IBook;
    const input = { price: 60_000, szDecimals: 5, isSpot: false };
    expect(getFinerCoveringBookTarget(input, raw)?.options).toEqual({
      nSigFigs: null,
      mantissa: null,
    });
    const narrow = {
      ...raw,
      levels: [prices(59_999, -1, 20), prices(60_001, 1, 20)],
    } satisfies IBook;
    expect(getFinerCoveringBookTarget(input, narrow)).toBeUndefined();
    expect(shouldWidenDepthBook(narrow, input.price)).toBe(true);
    expect(
      shouldWidenDepthBook(
        { ...narrow, levels: [narrow.levels[0], []] },
        input.price,
      ),
    ).toBe(false);
    expect(
      shouldWidenDepthBook(
        { ...narrow, levels: [narrow.levels[0], narrow.levels[1].slice(0, 8)] },
        input.price,
      ),
    ).toBe(true);
    expect(
      shouldWidenDepthBook(
        { ...narrow, levels: [raw.levels[0], narrow.levels[1].slice(0, 8)] },
        input.price,
      ),
    ).toBe(false);
  });

  it('does not invent a midpoint from a single-sided or crossed quote', () => {
    expect(getTrueDepthMidPrice('99', '101')).toBe(100);
    expect(getTrueDepthMidPrice('99', undefined)).toBeUndefined();
    expect(getTrueDepthMidPrice('101', '99')).toBeUndefined();
  });
});
