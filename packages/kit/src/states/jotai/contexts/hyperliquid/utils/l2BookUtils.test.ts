import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  shouldClearPerpsMarketDataForInstrument,
  shouldUpdatePerpsBbo,
  shouldUpdatePerpsL2Book,
  withPerpsBboLocalReceivedAt,
  withPerpsL2BookLocalReceivedAt,
} from './l2BookUtils';

function buildBook({
  time,
  coin = 'ETH',
  bidPx = '100',
  askPx = '101',
  levels,
}: {
  time?: number;
  coin?: string;
  bidPx?: string;
  askPx?: string;
  levels?: HL.IBook['levels'];
}): HL.IBook {
  return {
    coin,
    time: time as number,
    levels: levels ?? [
      [{ px: bidPx, sz: '1', n: 1 }],
      [{ px: askPx, sz: '2', n: 1 }],
    ],
  };
}

describe('shouldUpdatePerpsL2Book', () => {
  it('updates when there is no current book', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: null,
        nextBook: buildBook({ time: 1000 }),
      }),
    ).toBe(true);
  });

  it('updates when the incoming book belongs to a different coin', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000, coin: 'ETH' }),
        nextBook: buildBook({ time: 1000, coin: 'BTC' }),
      }),
    ).toBe(true);
  });

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

  it('does not refresh identical books without a finite next timestamp', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000 }),
        nextBook: buildBook({ time: undefined }),
      }),
    ).toBe(false);

    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000 }),
        nextBook: buildBook({ time: Number.NaN }),
      }),
    ).toBe(false);
  });

  it('refreshes identical books when the current timestamp is missing', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: undefined }),
        nextBook: buildBook({ time: 1000 }),
      }),
    ).toBe(true);
  });

  it('updates when order book levels change', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000 }),
        nextBook: buildBook({ time: 1000, bidPx: '99' }),
      }),
    ).toBe(true);
  });

  it('updates when side or level counts change', () => {
    expect(
      shouldUpdatePerpsL2Book({
        currentBook: buildBook({ time: 1000 }),
        nextBook: buildBook({
          time: 1000,
          levels: [[{ px: '100', sz: '1', n: 1 }], []],
        }),
      }),
    ).toBe(true);
  });
});

describe('perps market data local receive helpers', () => {
  it('adds local receive timestamps without changing market payload fields', () => {
    expect(
      withPerpsL2BookLocalReceivedAt(buildBook({ time: 1000 }), 2000),
    ).toMatchObject({
      coin: 'ETH',
      time: 1000,
      localReceivedAt: 2000,
    });

    expect(
      withPerpsBboLocalReceivedAt(
        {
          coin: 'ETH',
          time: 1000,
          bbo: [
            { px: '100', sz: '1', n: 1 },
            { px: '101', sz: '1', n: 1 },
          ],
        },
        2000,
      ),
    ).toMatchObject({
      coin: 'ETH',
      time: 1000,
      localReceivedAt: 2000,
    });
  });

  it('clears market data only when an existing payload belongs to another coin', () => {
    expect(
      shouldClearPerpsMarketDataForInstrument({
        dataCoin: 'ETH',
        activeCoin: 'BTC',
      }),
    ).toBe(true);

    expect(
      shouldClearPerpsMarketDataForInstrument({
        dataCoin: 'ETH',
        activeCoin: 'ETH',
      }),
    ).toBe(false);

    expect(
      shouldClearPerpsMarketDataForInstrument({
        dataCoin: undefined,
        activeCoin: 'ETH',
      }),
    ).toBe(false);
  });
});

describe('shouldUpdatePerpsBbo', () => {
  function buildBbo({
    time,
    bidPx = '100',
    askPx = '101',
  }: {
    time?: number;
    bidPx?: string;
    askPx?: string;
  }): HL.IWsBbo {
    return {
      coin: 'ETH',
      time: time as number,
      bbo: [
        { px: bidPx, sz: '1', n: 1 },
        { px: askPx, sz: '1', n: 1 },
      ],
    };
  }

  it('updates when BBO prices change', () => {
    expect(
      shouldUpdatePerpsBbo({
        currentBbo: buildBbo({ time: 1000 }),
        nextBbo: buildBbo({ time: 1000, askPx: '102' }),
      }),
    ).toBe(true);
  });

  it('refreshes identical BBO prices before the freshness gate expires', () => {
    expect(
      shouldUpdatePerpsBbo({
        currentBbo: buildBbo({ time: 1000 }),
        nextBbo: buildBbo({
          time: 1000 + PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS / 2,
        }),
      }),
    ).toBe(true);
  });

  it('dedupes tiny identical BBO timestamp-only changes', () => {
    expect(
      shouldUpdatePerpsBbo({
        currentBbo: buildBbo({ time: 1000 }),
        nextBbo: buildBbo({
          time: 1000 + PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS / 2 - 1,
        }),
      }),
    ).toBe(false);
  });
});
