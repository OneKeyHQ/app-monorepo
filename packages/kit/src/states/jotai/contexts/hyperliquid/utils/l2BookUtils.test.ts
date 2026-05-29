import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

import { shouldUpdatePerpsL2Book } from './l2BookUtils';

function buildBook({
  time,
  bidPx = '100',
  askPx = '101',
}: {
  time: number;
  bidPx?: string;
  askPx?: string;
}): HL.IBook {
  return {
    coin: 'ETH',
    time,
    levels: [[{ px: bidPx, sz: '1', n: 1 }], [{ px: askPx, sz: '2', n: 1 }]],
  };
}

describe('shouldUpdatePerpsL2Book', () => {
  it('updates when identical levels carry a fresher websocket timestamp', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000 }),
        nextBook: buildBook({ time: 31_000 }),
      }),
    ).toBe(true);
  });

  it('does not update every tiny timestamp-only change', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000 }),
        nextBook: buildBook({
          time: 1000 + PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS / 2 - 1,
        }),
      }),
    ).toBe(false);
  });

  it('keeps deduping identical books that do not advance freshness', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 31_000 }),
        nextBook: buildBook({ time: 1000 }),
      }),
    ).toBe(false);
  });

  it('updates when order book levels change', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000 }),
        nextBook: buildBook({ time: 1000, bidPx: '99' }),
      }),
    ).toBe(true);
  });
});
