/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import { useDustSweepFiatFormatter } from './useDustSweepFiatFormatter';

let mockCurrencyId = 'cny';
let mockCurrencyMap: Record<string, { unit: string; value: string }> = {};
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: mockCurrencyMap }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: mockCurrencyId } }],
}));

const rates = {
  usd: { unit: '$', value: '1' },
  cny: { unit: '¥', value: '7.1' },
};

beforeEach(() => {
  mockCurrencyId = 'cny';
  mockCurrencyMap = rates;
});

it('converts USD values into the display currency', () => {
  const { result } = renderHook(() => useDustSweepFiatFormatter());

  expect(result.current('10')).toBe('¥71.00');
  expect(result.current('0')).toBe('¥0.00');
});

it('keeps USD when the display currency is USD', () => {
  mockCurrencyId = 'usd';
  const { result } = renderHook(() => useDustSweepFiatFormatter());

  expect(result.current('10')).toBe('$10.00');
});

it('keeps the USD amount and symbol until the rate map loads', () => {
  mockCurrencyMap = {};
  const { result } = renderHook(() => useDustSweepFiatFormatter());

  expect(result.current('10')).toBe('$10.00');
});

it.each([
  ['the USD rate is zero', { ...rates, usd: { unit: '$', value: '0' } }],
  ['the target rate is zero', { ...rates, cny: { unit: '¥', value: '0' } }],
  ['the target rate is invalid', { ...rates, cny: { unit: '¥', value: '--' } }],
])('keeps the USD amount and symbol when %s', (_case, map) => {
  mockCurrencyMap = map;
  const { result } = renderHook(() => useDustSweepFiatFormatter());

  expect(result.current('10')).toBe('$10.00');
});
