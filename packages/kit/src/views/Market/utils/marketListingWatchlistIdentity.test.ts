import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import { resolveMarketListingWatchlistIdentity } from './marketListingWatchlistIdentity';

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

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (task: () => Promise<unknown>) => task(),
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
