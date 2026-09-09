/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { useMarketBannerList } from './useMarketBannerList';

let mockResult: IMarketBannerItem[] | undefined;
let mockLoading: boolean | undefined;
let mockLocale = 'en-US';
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockResult, isLoading: mockLoading }),
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
it('does not blank the page again when retrying a failed initial request', () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  mockLoading = false;
  rerender();
  expect(result.current.isLoading).toBe(false);
  mockLoading = true;
  rerender();
  expect(result.current.isLoading).toBe(false);
});
