import type { IServerTimeBounds } from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type { IL2BookResponse } from '@onekeyhq/shared/types/hyperliquid/sdk';

import ServiceHyperliquid from './ServiceHyperliquid';

const mockL2Book = jest.fn<Promise<IL2BookResponse>, [{ coin: string }]>();
const mockGetTime = jest.fn<Promise<IServerTimeBounds | undefined>, []>();

jest.mock('p-timeout', () => ({
  __esModule: true,
  default: <T>(promise: Promise<T>) => promise,
}));
jest.mock('./utils/fundingHistory', () => ({}));
jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    infoClient: { l2Book: (params: { coin: string }) => mockL2Book(params) },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: {
    getServerTimeBoundsWithClockRecovery: () => mockGetTime(),
  },
}));

const service = Object.create(
  ServiceHyperliquid.prototype,
) as ServiceHyperliquid;
const book = {
  coin: 'BTC',
  levels: [[{ px: '100', sz: '1', n: 1 }], [{ px: '101', sz: '1', n: 1 }]],
  time: 1_790_000_000_000,
} satisfies IL2BookResponse;
beforeEach(() => {
  mockL2Book.mockReset().mockResolvedValue(book);
  mockGetTime.mockReset().mockResolvedValue(undefined);
});

it('returns the original REST book to ordinary callers without requesting a clock', async () => {
  await expect(service.fetchL2BookByCoin({ coin: 'BTC' })).resolves.toBe(book);
  expect(mockL2Book).toHaveBeenCalledWith({ coin: 'BTC', nSigFigs: null });
  expect(mockGetTime).not.toHaveBeenCalled();
});

it('obtains the paired clock bounds before fetching the timed book', async () => {
  const clockBounds = {
    earliestMs: book.time - 500,
    latestMs: book.time + 500,
    localTimeMs: book.time + 31_000,
    localMonotonicTimeMs: 175_000,
  };
  mockGetTime.mockImplementationOnce(async () => {
    expect(mockL2Book).not.toHaveBeenCalled();
    return clockBounds;
  });
  await expect(
    service.fetchL2BookByCoin({ coin: 'BTC', includeServerTime: true }),
  ).resolves.toEqual({ ...book, serverTimeBounds: clockBounds });
  expect(mockL2Book).toHaveBeenCalledTimes(1);
});

it('leaves the reported clock absent when recovery fails', async () => {
  await expect(
    service.fetchL2BookByCoin({ coin: 'BTC', includeServerTime: true }),
  ).resolves.toEqual({ ...book, serverTimeBounds: undefined });
});
