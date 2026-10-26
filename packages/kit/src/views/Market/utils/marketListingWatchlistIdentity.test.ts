import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import {
  acquireMarketListingWatchlistIdentity,
  resolveMarketListingWatchlistIdentity,
} from './marketListingWatchlistIdentity';

const mockAssetDetail = jest.fn();
const mockStockVariants = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetDetail: (...args: unknown[]): unknown =>
        mockAssetDetail(...args),
    },
    serviceMarketV2: {
      fetchMarketStockTokenVariants: (...args: unknown[]): unknown =>
        mockStockVariants(...args),
    },
  },
}));

const buildVariant = (
  overrides: Partial<IMarketStockTokenVariant> = {},
): IMarketStockTokenVariant => ({
  tokenId: 'aapl-on',
  issuer: 'ondo',
  symbol: 'AAPLon',
  networkId: 'evm--1',
  contractAddress: '0xAbCd',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
  ...overrides,
});

beforeEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  jest.clearAllMocks();
  resolveMarketListingWatchlistIdentity.clear();
});

it('resolves native assets with an empty contract address', async () => {
  mockAssetDetail.mockResolvedValue({
    asset: { symbol: 'BTC' },
    selectedVariant: { networkId: 'btc--0', tokenAddress: '', isNative: true },
  });
  await expect(
    resolveMarketListingWatchlistIdentity('asset', 'bitcoin'),
  ).resolves.toEqual({
    chainId: 'btc--0',
    contractAddress: '',
    isNative: true,
    tokenSymbol: 'BTC',
  });
  expect(mockAssetDetail).toHaveBeenCalledWith({
    assetId: 'bitcoin',
    currency: 'usd',
    autoHandleError: false,
  });
});

it('preserves Solana address case and normalizes EVM addresses', async () => {
  mockAssetDetail.mockResolvedValue({
    asset: { symbol: 'USDC' },
    selectedVariant: {
      networkId: 'sol--101',
      tokenAddress: 'AbCd',
      isNative: false,
    },
  });
  expect(
    (await resolveMarketListingWatchlistIdentity('asset', 'usdc'))
      ?.contractAddress,
  ).toBe('AbCd');
  mockStockVariants.mockResolvedValue({
    items: [buildVariant()],
    defaultTokenId: 'aapl-on',
  });
  expect(
    (await resolveMarketListingWatchlistIdentity('stock', 'AAPL'))
      ?.contractAddress,
  ).toBe('0xabcd');
});

it('uses the same default stock variant as the detail page', async () => {
  mockStockVariants.mockResolvedValue({
    items: [
      buildVariant({ tokenId: 'other' }),
      buildVariant({ tokenId: 'preferred', contractAddress: '0xDeF' }),
    ],
    defaultTokenId: 'preferred',
  });
  expect(
    (await resolveMarketListingWatchlistIdentity('stock', 'AAPL'))
      ?.contractAddress,
  ).toBe('0xdef');
});

it('falls back from an unavailable default to the first tradable variant', async () => {
  mockStockVariants.mockResolvedValue({
    items: [
      buildVariant({ isPaused: true }),
      buildVariant({ tokenId: 'fallback', contractAddress: '0xEf' }),
    ],
    defaultTokenId: 'aapl-on',
  });
  expect(
    (await resolveMarketListingWatchlistIdentity('stock', 'AAPL'))
      ?.contractAddress,
  ).toBe('0xef');
});

it('does not invent an identity for stocks without token variants', async () => {
  mockStockVariants.mockResolvedValue({ items: [] });
  await expect(
    resolveMarketListingWatchlistIdentity('stock', 'EMPTY'),
  ).resolves.toBeUndefined();
});

it.each([
  { networkId: 'evm--1', tokenAddress: '', isNative: false },
  { networkId: '', tokenAddress: '0x123', isNative: false },
  undefined,
])(
  'rejects missing or incomplete asset identity: %j',
  async (selectedVariant) => {
    mockAssetDetail.mockResolvedValue({
      asset: { symbol: 'TEST' },
      selectedVariant,
    });
    await expect(
      resolveMarketListingWatchlistIdentity('asset', 'test'),
    ).resolves.toBeUndefined();
  },
);

it('shares in-flight and cached requests between rows', async () => {
  mockStockVariants.mockResolvedValue({ items: [buildVariant()] });
  const [first, second] = await Promise.all([
    resolveMarketListingWatchlistIdentity('stock', 'AAPL'),
    resolveMarketListingWatchlistIdentity('stock', 'AAPL'),
  ]);
  expect(first).toEqual(second);
  await resolveMarketListingWatchlistIdentity('stock', 'AAPL');
  expect(mockStockVariants).toHaveBeenCalledTimes(1);
});

it('allows retry after a failed request', async () => {
  mockStockVariants
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [buildVariant()] });
  await expect(
    resolveMarketListingWatchlistIdentity('stock', 'AAPL'),
  ).rejects.toThrow('offline');
  // memoizee evicts rejected promises on the next microtask/tick.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await expect(
    resolveMarketListingWatchlistIdentity('stock', 'AAPL'),
  ).resolves.toMatchObject({ chainId: 'evm--1' });
});

it('skips abandoned queued rows and lets the new list load next', async () => {
  let unblock: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  mockStockVariants.mockImplementation(async () => {
    await blocked;
    return { items: [buildVariant()] };
  });
  const active = Array.from({ length: 4 }, (_, index) =>
    acquireMarketListingWatchlistIdentity('stock', `active-${index}`),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockStockVariants).toHaveBeenCalledTimes(4);
  const abandoned = Array.from({ length: 100 }, (_, index) =>
    acquireMarketListingWatchlistIdentity('stock', `old-${index}`),
  );
  abandoned.forEach((request) => request.release());
  const visible = acquireMarketListingWatchlistIdentity('stock', 'visible');
  unblock?.();
  await Promise.all(
    [...active, ...abandoned, visible].map((request) => request.promise),
  );
  expect(mockStockVariants).toHaveBeenCalledTimes(5);
  expect(mockStockVariants).toHaveBeenLastCalledWith({ stockId: 'visible' });
  active.forEach((request) => request.release());
  visible.release();

  const remounted = acquireMarketListingWatchlistIdentity('stock', 'old-0');
  await expect(remounted.promise).resolves.toMatchObject({ chainId: 'evm--1' });
  expect(mockStockVariants).toHaveBeenLastCalledWith({ stockId: 'old-0' });
  remounted.release();
});

it('keeps a shared queued request when another row still needs it', async () => {
  mockStockVariants.mockResolvedValue({ items: [buildVariant()] });
  const first = acquireMarketListingWatchlistIdentity('stock', 'shared');
  const second = acquireMarketListingWatchlistIdentity('stock', 'shared');
  first.release();
  first.release();
  await expect(second.promise).resolves.toMatchObject({ chainId: 'evm--1' });
  expect(mockStockVariants).toHaveBeenCalledTimes(1);
  second.release();
});

it('can reacquire a listing before its abandoned queue entry drains', async () => {
  mockStockVariants.mockResolvedValue({ items: [buildVariant()] });
  const abandoned = acquireMarketListingWatchlistIdentity('stock', 'remount');
  abandoned.release();
  const remounted = acquireMarketListingWatchlistIdentity('stock', 'remount');
  await expect(abandoned.promise).resolves.toBeUndefined();
  await expect(remounted.promise).resolves.toMatchObject({ chainId: 'evm--1' });
  expect(mockStockVariants).toHaveBeenCalledTimes(1);
  remounted.release();
});

it('shares an in-flight request with a newly mounted row', async () => {
  let unblock: (() => void) | undefined;
  mockStockVariants.mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      unblock = resolve;
    });
    return { items: [buildVariant()] };
  });
  const first = acquireMarketListingWatchlistIdentity('stock', 'in-flight');
  await new Promise((resolve) => setTimeout(resolve, 0));
  first.release();
  const second = acquireMarketListingWatchlistIdentity('stock', 'in-flight');
  unblock?.();
  await expect(second.promise).resolves.toMatchObject({ chainId: 'evm--1' });
  expect(mockStockVariants).toHaveBeenCalledTimes(1);
  second.release();
});
