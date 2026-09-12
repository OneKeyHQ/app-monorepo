/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  EMarketBannerType,
  type IMarketBannerItem,
} from '@onekeyhq/shared/types/marketV2';

import {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
  fetchMarketBannerTokenListForPlatform,
} from './marketBannerListPlatformApi';
import { useMarketBannerList } from './useMarketBannerList';

let mockResult: IMarketBannerItem[] | undefined;
let mockLoading: boolean | undefined;
let mockLocale = 'en-US';
let mockRequest: () => Promise<unknown>;
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (request: () => Promise<unknown>) => {
    mockRequest = request;
    return { result: mockResult, isLoading: mockLoading };
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
}));
jest.mock('./marketBannerListPlatformApi', () => ({
  fetchMarketBannerListForPlatform: jest.fn(),
  fetchMarketBannerStockTokenListForPlatform: jest.fn(),
  fetchMarketBannerTokenListForPlatform: jest.fn(),
}));

const makeBanner = (
  overrides: Partial<IMarketBannerItem> = {},
): IMarketBannerItem => ({
  _id: 'banner',
  title: 'Banner',
  rank: 1,
  mode: 4,
  payload: '',
  miniBundlerVersion: '',
  backgroundColor: 'bg/subdued',
  tokenListId: 'banner-list',
  ...overrides,
});

beforeEach(() => {
  mockResult = undefined;
  mockLoading = undefined;
  mockLocale = 'en-US';
  jest.mocked(fetchMarketBannerListForPlatform).mockReset();
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockReset();
  jest.mocked(fetchMarketBannerTokenListForPlatform).mockReset();
  jest
    .mocked(fetchMarketBannerListForPlatform)
    .mockRejectedValue(new Error('offline'));
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([]);
  jest.mocked(fetchMarketBannerTokenListForPlatform).mockResolvedValue([]);
});
it('treats the pre-request frame as pending', () => {
  const { result } = renderHook(() => useMarketBannerList());
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isFetched).toBe(false);
});
it('accepts an empty cached result without showing a skeleton', () => {
  mockResult = [];
  const { result } = renderHook(() => useMarketBannerList());
  expect(result.current.isLoading).toBe(false);
  expect(result.current.isFetched).toBe(true);
});
it('does not blank the page again when retrying a settled initial request', async () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await expect(mockRequest()).rejects.toThrow('offline');
  });
  mockLoading = false;
  rerender();
  expect(result.current.isLoading).toBe(false);
  mockLoading = true;
  rerender();
  expect(result.current.isLoading).toBe(false);
});

it('does not inherit the previous locale completion before the new request starts', async () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await expect(mockRequest()).rejects.toThrow('offline');
  });
  mockLoading = false;
  mockLocale = 'zh-CN';
  rerender();
  expect(result.current.isLoading).toBe(true);
  await act(async () => {
    await expect(mockRequest()).rejects.toThrow('offline');
  });
  expect(result.current.isLoading).toBe(false);
});
it('ignores a request callback from the previous locale', async () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  const oldRequest = mockRequest;
  mockLocale = 'zh-CN';
  rerender();
  await act(async () => {
    await expect(oldRequest()).rejects.toThrow('offline');
  });
  expect(result.current.isLoading).toBe(true);
});

it('waits for successful banner data to commit before releasing the native layout gate', async () => {
  jest.mocked(fetchMarketBannerListForPlatform).mockResolvedValue([]);
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await mockRequest();
  });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isFetched).toBe(false);
  mockResult = [];
  rerender();
  expect(result.current.isLoading).toBe(false);
  expect(result.current.isFetched).toBe(true);
});

it.each([EMarketBannerType.Index, EMarketBannerType.StockIndex])(
  'hydrates %s quotes from the inline indices payload',
  async (type) => {
    const indices = [
      {
        logo: '',
        name: 'S&P 500',
        symbol: '^GSPC',
        price: '7656.98',
        priceChange24hPercent: '0.86',
      },
    ];
    jest
      .mocked(fetchMarketBannerListForPlatform)
      .mockResolvedValue([makeBanner({ type, indices })]);
    renderHook(() => useMarketBannerList());

    let hydrated: unknown;
    await act(async () => {
      hydrated = await mockRequest();
    });

    expect(hydrated).toEqual([makeBanner({ type, indices, tokens: indices })]);
    expect(fetchMarketBannerStockTokenListForPlatform).not.toHaveBeenCalled();
  },
);

it('keeps stock-backed index assets on the stock list endpoint', async () => {
  const stock = {
    stockId: 'stock-index',
    name: 'Index Asset',
    symbol: 'INDEX',
    logoUrl: '',
    price: '100',
    priceChange24hPercent: '1',
    assetType: 'index' as const,
    currency: 'USD' as const,
  };
  jest
    .mocked(fetchMarketBannerListForPlatform)
    .mockResolvedValue([
      makeBanner({ type: EMarketBannerType.Stock, assetType: 'index' }),
    ]);
  jest
    .mocked(fetchMarketBannerStockTokenListForPlatform)
    .mockResolvedValue([stock]);
  renderHook(() => useMarketBannerList());

  let hydrated: unknown;
  await act(async () => {
    hydrated = await mockRequest();
  });

  expect(fetchMarketBannerStockTokenListForPlatform).toHaveBeenCalledWith(
    'banner-list',
  );
  expect(hydrated).toEqual([
    makeBanner({
      type: EMarketBannerType.Stock,
      assetType: 'index',
      tokens: [
        {
          logo: '',
          name: 'Index Asset',
          symbol: 'INDEX',
          price: '100',
          priceChange24hPercent: '1',
        },
      ],
    }),
  ]);
});
