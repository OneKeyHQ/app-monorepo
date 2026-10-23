/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useChartTypeface } from './useChartTypeface';

const mockLoadData = jest.fn<Promise<object>, [string]>();
const mockFace = {};
jest.mock('react-native', () => ({
  Image: { resolveAssetSource: () => ({ uri: 'brand.ttf' }) },
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: (uri: string) => mockLoadData(uri) },
    Typeface: { MakeFreeTypeFaceFromData: () => mockFace },
  },
}));

it('keeps the fallback on failure, shares the pending font and reuses it immediately on remount', async () => {
  mockLoadData.mockRejectedValueOnce(new OneKeyLocalError('Unavailable font'));
  const failed = renderHook(useChartTypeface);
  await act(async () => Promise.resolve());
  expect(failed.result.current).toBeNull();
  failed.unmount();

  let resolveFont: (value: object) => void = () => undefined;
  mockLoadData.mockImplementationOnce(
    () =>
      new Promise<object>((resolve) => {
        resolveFont = resolve;
      }),
  );
  const first = renderHook(useChartTypeface);
  const second = renderHook(useChartTypeface);
  expect(first.result.current).toBeNull();
  expect(second.result.current).toBeNull();
  first.unmount();
  await act(async () => resolveFont({}));
  expect(second.result.current).toBe(mockFace);

  const remounted = renderHook(useChartTypeface);
  expect(remounted.result.current).toBe(mockFace);
  expect(mockLoadData).toHaveBeenCalledTimes(2);
});
