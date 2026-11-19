/** @jest-environment jsdom */

import { useMarketBasicConfig } from '.';

import { act, renderHook } from '@testing-library/react';
let mockLocale = 'en-US';
let mockRequest: () => Promise<unknown>;
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (request: () => Promise<unknown>) => {
    mockRequest = request;
    return { result: undefined, isLoading: false };
  },
}));
jest.mock('./fetchMarketBasicConfigForPlatform', () => ({
  fetchMarketBasicConfigForPlatform: jest.fn(),
}));
beforeEach(() => {
  mockLocale = 'en-US';
});
it('reports pending immediately for a new uncached locale despite the old loading=false', async () => {
  const { result, rerender } = renderHook(() => useMarketBasicConfig());
  expect(result.current.isLoading).toBe(true);
  await act(async () => {
    await mockRequest();
  });
  expect(result.current.isLoading).toBe(false);
  mockLocale = 'zh-CN';
  rerender();
  expect(result.current.isLoading).toBe(true);
  await act(async () => {
    await mockRequest();
  });
  expect(result.current.isLoading).toBe(false);
});
it('does not settle the new locale when an old request finishes', async () => {
  const { result, rerender } = renderHook(() => useMarketBasicConfig());
  const oldRequest = mockRequest;
  mockLocale = 'zh-CN';
  rerender();
  await act(async () => {
    await oldRequest();
  });
  expect(result.current.isLoading).toBe(true);
});
