import type {
  IMarketAssetDetailData,
  IMarketAssetVariant,
} from '@onekeyhq/shared/types/market';

import { resolveSwapMarketAsset } from './resolveSwapMarketAsset';

const mockSearch = jest.fn<
  Promise<unknown>,
  [string, { autoHandleError?: boolean; resolveNativeAssetId?: boolean }?]
>();
const mockList = jest.fn<Promise<unknown>, [{ type: string }]>();
const mockDetail = jest.fn<Promise<unknown>, [{ assetId: string }]>();
const mockConfig = jest.fn<
  Promise<unknown>,
  [{ autoHandleError?: boolean }?]
>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      searchV2Token: (...args: Parameters<typeof mockSearch>) =>
        mockSearch(...args),
      fetchMarketAssetList: (...args: Parameters<typeof mockList>) =>
        mockList(...args),
      fetchMarketAssetDetail: (...args: Parameters<typeof mockDetail>) =>
        mockDetail(...args),
    },
    serviceMarketV2: {
      fetchMarketBasicConfig: (...args: Parameters<typeof mockConfig>) =>
        mockConfig(...args),
    },
  },
}));

const token = {
  networkId: 'evm--1',
  tokenAddress: '',
  isNative: true,
  symbol: 'ETH',
};
const variant: IMarketAssetVariant = {
  variantId: 'eth-main',
  networkId: 'evm--1',
  tokenAddress: 'native',
  isNative: true,
  isDefault: true,
  networkName: '',
  networkSymbol: '',
  networkLogoUrl: '',
};
function detail(assetId: string, selectedVariant = variant) {
  return {
    asset: { assetId, name: 'Ether', symbol: 'ETH', logoUrl: '' },
    selectedVariant,
    variants: [],
    about: '',
    market: {
      price: '',
      priceChange24h: '',
      priceChange24hPercent: '',
      marketCap: '',
      marketCapRank: null,
      volume24h: '',
      circulatingSupply: '',
      fdv: '',
      totalSupply: '',
      maxSupply: '',
    },
    performance: {
      priceChange7dPercent: '',
      price7dAgo: '',
      priceChange30dPercent: '',
      price30dAgo: '',
      priceChange3mPercent: '',
      price3mAgo: '',
      priceChange1yPercent: '',
      price1yAgo: '',
      allTimeHighChangePercent: '',
      allTimeHighPrice: '',
    },
  } satisfies IMarketAssetDetailData;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSearch.mockResolvedValue([]);
  mockList.mockResolvedValue({ list: [], total: 0 });
  mockConfig.mockResolvedValue({ code: 0, data: { assetCategories: [] } });
});

afterEach(() => jest.useRealTimers());

describe('resolveSwapMarketAsset', () => {
  it('opens the matching native variant using its Market route address', async () => {
    mockSearch.mockResolvedValue([
      { assetId: 'ethereum', network: 'evm--1', isNative: true },
    ]);
    mockList.mockResolvedValue({ list: [{ assetId: 'ethereum' }], total: 1 });
    mockDetail.mockResolvedValue(detail('ethereum'));
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toEqual({
      marketTokenId: 'ethereum',
      marketVariantId: 'eth-main',
      marketTokenCategory: 'top_coins',
      network: 'evm--1',
      tokenAddress: 'native',
      isNative: true,
    });
  });

  it('checks a search candidate before unrelated listed assets', async () => {
    mockSearch.mockResolvedValue([
      { assetId: 'ether', network: 'evm--1', isNative: true },
    ]);
    mockList.mockResolvedValue({
      list: [{ assetId: 'other' }, { assetId: 'ether' }],
      total: 2,
    });
    mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
      Promise.resolve(
        detail(
          assetId,
          assetId === 'ether' ? variant : { ...variant, networkId: 'other' },
        ),
      ),
    );
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toMatchObject({ marketTokenId: 'ether' });
    expect(mockDetail.mock.calls[0]?.[0].assetId).toBe('ether');
    expect(mockDetail).toHaveBeenCalledTimes(1);
  });

  it('prioritizes same-symbol native list entries without enriching search results', async () => {
    mockSearch.mockResolvedValue([]);
    mockConfig.mockResolvedValue({
      code: 0,
      data: { assetCategories: [{ category: 'defi' }] },
    });
    mockList.mockImplementation(async ({ type }: { type: string }) => ({
      list:
        type === 'defi'
          ? [{ assetId: 'other', symbol: 'OTHER' }]
          : [{ assetId: 'ether', symbol: 'ETH' }],
      total: 1,
    }));
    mockDetail.mockResolvedValue(detail('ether'));
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toMatchObject({ marketTokenId: 'ether' });
    expect(mockSearch).toHaveBeenCalledWith('ETH', {
      autoHandleError: false,
      resolveNativeAssetId: false,
    });
    expect(mockDetail).toHaveBeenCalledTimes(1);
    expect(mockDetail.mock.calls[0]?.[0].assetId).toBe('ether');
  });

  it('falls back to other symbols when the preferred native candidate does not match', async () => {
    mockList.mockResolvedValue({
      list: [
        { assetId: 'same-symbol', symbol: 'ETH' },
        { assetId: 'alias', symbol: 'OTHER' },
      ],
      total: 2,
    });
    mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
      Promise.resolve(
        detail(
          assetId,
          assetId === 'alias' ? variant : { ...variant, networkId: 'other' },
        ),
      ),
    );
    const result = resolveSwapMarketAsset(token, new AbortController().signal);
    await jest.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toMatchObject({ marketTokenId: 'alias' });
  });

  it('starts the list fallback if the search candidate stalls', async () => {
    mockSearch.mockResolvedValue([
      { assetId: 'stalled', network: 'evm--1', isNative: true },
    ]);
    mockList.mockResolvedValue({
      list: [{ assetId: 'stalled' }, { assetId: 'ether' }],
      total: 2,
    });
    mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
      assetId === 'stalled'
        ? new Promise(() => undefined)
        : Promise.resolve(detail(assetId)),
    );
    const result = resolveSwapMarketAsset(token, new AbortController().signal);
    await jest.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toMatchObject({ marketTokenId: 'ether' });
  });

  it('uses the list when search is unavailable', async () => {
    mockSearch.mockRejectedValue(new Error('search offline'));
    mockList.mockResolvedValue({
      list: [{ assetId: 'ether', symbol: 'ETH' }],
      total: 1,
    });
    mockDetail.mockResolvedValue(detail('ether'));
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toMatchObject({ marketTokenId: 'ether' });
  });

  it('ignores malformed search entries and checks the market list', async () => {
    mockSearch.mockResolvedValue([null, { network: 'other' }]);
    mockList.mockResolvedValue({
      list: [{ assetId: 'ether', symbol: 'ETH' }],
      total: 1,
    });
    mockDetail.mockResolvedValue(detail('ether'));
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toMatchObject({ marketTokenId: 'ether' });
  });

  it('finds a listed contract variant even when search has no asset ID', async () => {
    mockConfig.mockResolvedValue({
      code: 0,
      data: { assetCategories: [{ category: 'defi' }] },
    });
    mockList.mockImplementation(async ({ type }: { type: string }) => ({
      list: type === 'defi' ? [{ assetId: 'ether' }] : [],
      total: 1,
    }));
    mockDetail.mockResolvedValue(
      detail('ether', {
        ...variant,
        variantId: 'base-weth',
        networkId: 'evm--8453',
        tokenAddress: '0xAbCd',
        isNative: false,
      }),
    );
    await expect(
      resolveSwapMarketAsset(
        {
          networkId: 'evm--8453',
          tokenAddress: '0xabcd',
          isNative: false,
          symbol: 'WETH',
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      marketTokenId: 'ether',
      marketVariantId: 'base-weth',
    });
  });

  it('does not mistake another chain or contract for the requested token', async () => {
    mockList.mockResolvedValue({
      list: [{ assetId: 'ether', symbol: 'ETH' }],
      total: 1,
    });
    mockDetail.mockResolvedValue(
      detail('ether', {
        ...variant,
        networkId: 'evm--8453',
        isNative: false,
        tokenAddress: '0xother',
      }),
    );
    await expect(
      resolveSwapMarketAsset(
        {
          networkId: 'evm--8453',
          tokenAddress: '0x1234',
          isNative: false,
          symbol: 'ETH',
        },
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
  });

  it('returns a verified match without waiting for an unrelated stalled request', async () => {
    mockList.mockResolvedValue({
      list: [
        { assetId: 'other', symbol: 'ETH' },
        { assetId: 'ether', symbol: 'ETH' },
      ],
      total: 2,
    });
    mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
      assetId === 'other'
        ? new Promise(() => undefined)
        : Promise.resolve(detail(assetId)),
    );
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toMatchObject({ marketTokenId: 'ether' });
  });

  it('continues past a stalled asset to a later batch', async () => {
    mockList.mockResolvedValue({
      list: Array.from({ length: 10 }, (_, i) => ({
        assetId: `asset-${i}`,
        symbol: 'ETH',
      })),
      total: 10,
    });
    mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
      assetId === 'asset-0'
        ? new Promise(() => undefined)
        : Promise.resolve(
            detail(
              assetId,
              assetId === 'asset-9'
                ? variant
                : { ...variant, networkId: 'other' },
            ),
          ),
    );
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toMatchObject({ marketTokenId: 'asset-9' });
  });

  it('falls back to ordinary detail when the category config is invalid', async () => {
    mockConfig.mockResolvedValue({
      code: 0,
      data: { assetCategories: [null] },
    });
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toBeUndefined();
  });

  it('falls back to ordinary detail when candidate lookup fails', async () => {
    mockList.mockResolvedValue({
      list: [{ assetId: 'ether', symbol: 'ETH' }],
      total: 1,
    });
    mockDetail.mockRejectedValue(undefined);
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toBeUndefined();
  });

  it('falls back to ordinary detail when a matching variant has no ID', async () => {
    mockList.mockResolvedValue({
      list: [{ assetId: 'ether', symbol: 'ETH' }],
      total: 1,
    });
    mockDetail.mockResolvedValue(
      detail('ether', { ...variant, variantId: '' }),
    );
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toBeUndefined();
  });

  it('falls back to ordinary detail when a list request fails', async () => {
    mockList.mockRejectedValue(new Error('list offline'));
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toBeUndefined();
  });

  it('stops scheduling after a failed candidate and ignores late results', async () => {
    mockList.mockResolvedValue({
      list: Array.from({ length: 12 }, (_, index) => ({
        assetId: `asset-${index}`,
        symbol: index < 2 ? 'ETH' : 'OTHER',
      })),
      total: 12,
    });
    let finish!: (value: IMarketAssetDetailData) => void;
    let lateAssetId = '';
    mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
      assetId === 'asset-0'
        ? Promise.reject(new Error('candidate offline'))
        : new Promise((resolve) => {
            lateAssetId = assetId;
            finish = resolve;
          }),
    );
    const result = resolveSwapMarketAsset(token, new AbortController().signal);
    await jest.advanceTimersByTimeAsync(0);
    const requestsAfterFailure = mockDetail.mock.calls.length;
    await jest.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBeUndefined();
    const requestsAtFallback = mockDetail.mock.calls.length;
    expect(requestsAtFallback).toBe(requestsAfterFailure);
    finish(detail(lateAssetId));
    await jest.advanceTimersByTimeAsync(0);
    expect(mockDetail).toHaveBeenCalledTimes(requestsAtFallback);
  });

  it('accepts a verified preferred candidate after another request fails', async () => {
    mockList.mockResolvedValue({
      list: [
        { assetId: 'other', symbol: 'ETH' },
        { assetId: 'ether', symbol: 'ETH' },
      ],
      total: 2,
    });
    let finish!: (value: IMarketAssetDetailData) => void;
    mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
      assetId === 'other'
        ? Promise.reject(new Error('candidate offline'))
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const result = resolveSwapMarketAsset(token, new AbortController().signal);
    await jest.advanceTimersByTimeAsync(1000);
    finish(detail('ether'));
    await expect(result).resolves.toMatchObject({ marketTokenId: 'ether' });
  });

  it('checks a later priority list after another category fails', async () => {
    mockConfig.mockResolvedValue({
      code: 0,
      data: { assetCategories: [{ category: 'defi' }] },
    });
    let finishList!: (value: unknown) => void;
    mockList.mockImplementation(({ type }: { type: string }) =>
      type === 'defi'
        ? Promise.reject(new Error('category offline'))
        : new Promise((resolve) => {
            finishList = resolve;
          }),
    );
    mockDetail.mockResolvedValue(detail('ether'));
    const result = resolveSwapMarketAsset(token, new AbortController().signal);
    await jest.advanceTimersByTimeAsync(1000);
    finishList({ list: [{ assetId: 'ether', symbol: 'ETH' }], total: 1 });
    await expect(result).resolves.toMatchObject({ marketTokenId: 'ether' });
  });

  it('bounds waiting when all candidates stall', async () => {
    mockList.mockResolvedValue({
      list: Array.from({ length: 12 }, (_, index) => ({
        assetId: `asset-${index}`,
        symbol: 'ETH',
      })),
      total: 12,
    });
    let finish!: (value: IMarketAssetDetailData) => void;
    let lateAssetId = '';
    mockDetail.mockImplementation(
      ({ assetId }: { assetId: string }) =>
        new Promise((resolve) => {
          lateAssetId = assetId;
          finish = resolve;
        }),
    );
    const result = resolveSwapMarketAsset(token, new AbortController().signal);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(result).resolves.toBeUndefined();
    const requestsAtFallback = mockDetail.mock.calls.length;
    expect(requestsAtFallback).toBe(8);
    finish(detail(lateAssetId));
    await jest.advanceTimersByTimeAsync(0);
    expect(mockDetail).toHaveBeenCalledTimes(requestsAtFallback);
  });

  it('returns a top coin even if another category fails', async () => {
    mockConfig.mockResolvedValue({
      code: 0,
      data: { assetCategories: [{ category: 'defi' }] },
    });
    mockList.mockImplementation(({ type }: { type: string }) =>
      type === 'defi'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({
            list: [{ assetId: 'ether', symbol: 'ETH' }],
            total: 1,
          }),
    );
    mockDetail.mockResolvedValue(detail('ether'));
    await expect(
      resolveSwapMarketAsset(token, new AbortController().signal),
    ).resolves.toMatchObject({ marketTokenId: 'ether' });
  });

  it('does not schedule detail requests after leaving the page', async () => {
    const controller = new AbortController();
    mockSearch.mockImplementation(async () => {
      controller.abort();
      return [];
    });
    await expect(
      resolveSwapMarketAsset(token, controller.signal),
    ).resolves.toBeUndefined();
    expect(mockList).not.toHaveBeenCalled();
    expect(mockDetail).not.toHaveBeenCalled();
  });

  it('ignores a matching detail response after the page is closed', async () => {
    const controller = new AbortController();
    let finish!: (value: IMarketAssetDetailData) => void;
    mockList.mockResolvedValue({
      list: [{ assetId: 'ether', symbol: 'ETH' }],
      total: 1,
    });
    mockDetail.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const result = resolveSwapMarketAsset(token, controller.signal);
    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    finish(detail('ether'));
    await expect(result).resolves.toBeUndefined();
  });
});
