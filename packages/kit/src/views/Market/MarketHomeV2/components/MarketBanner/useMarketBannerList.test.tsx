/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketBannerListForPlatform } from './marketBannerListPlatformApi';
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
}));

beforeEach(() => {
  mockResult = undefined;
  mockLoading = undefined;
  mockLocale = 'en-US';
  jest.mocked(fetchMarketBannerListForPlatform).mockReset();
  jest
    .mocked(fetchMarketBannerListForPlatform)
    .mockRejectedValue(new Error('offline'));
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
    await expect(mockRequest()).resolves.toBeUndefined();
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
    await expect(mockRequest()).resolves.toBeUndefined();
  });
  mockLoading = false;
  mockLocale = 'zh-CN';
  rerender();
  expect(result.current.isLoading).toBe(true);
  await act(async () => {
    await expect(mockRequest()).resolves.toBeUndefined();
  });
  expect(result.current.isLoading).toBe(false);
});
it('ignores a request callback from the previous locale', async () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  const oldRequest = mockRequest;
  mockLocale = 'zh-CN';
  rerender();
  await act(async () => {
    await expect(oldRequest()).resolves.toBeUndefined();
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

it('preserves a committed cache replay when revalidation fails', async () => {
  mockResult = [];
  const { result } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await expect(mockRequest()).resolves.toBe(mockResult);
  });
  expect(result.current.isFetched).toBe(true);
  expect(result.current.isLoading).toBe(false);
});
