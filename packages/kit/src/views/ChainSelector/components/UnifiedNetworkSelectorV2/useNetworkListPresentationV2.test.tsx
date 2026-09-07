/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';

import { useNetworkListPresentationV2 } from './useNetworkListPresentationV2';

const mockTheme = new Proxy({}, { get: () => ({ val: '#000000' }) });
let mockHideValue = false;
let mockCurrency = 'usd';
let mockCurrencyMap: Record<string, { unit: string; value: number }> = {};

jest.mock('@onekeyhq/components', () => ({
  useTheme: () => mockTheme,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: mockCurrencyMap }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: mockCurrency } }],
  useSettingsValuePersistAtom: () => [{ hideValue: mockHideValue }],
}));

describe('network currency presentation V2', () => {
  beforeEach(() => {
    mockHideValue = false;
    mockCurrency = 'usd';
    mockCurrencyMap = {
      usd: { unit: '$', value: 1 },
      btc: { unit: '₿', value: 0.000_001 },
      eur: { unit: '€', value: 0.8 },
    };
  });

  it('uses the original Currency exchange-rate conversion and target unit', () => {
    mockCurrency = 'eur';
    const { result } = renderHook(() => useNetworkListPresentationV2('usd'));
    expect(result.current.formatCurrencyValue('10')).toEqual({
      text: numberFormatAsRenderText('8', {
        formatter: 'price',
        formatterOptions: { currency: '€' },
      }),
    });
  });

  it('preserves small-value number segments instead of expanding the displayed zeros', () => {
    mockCurrency = 'btc';
    const { result } = renderHook(() => useNetworkListPresentationV2('usd'));
    const actual = result.current.formatCurrencyValue('2');
    const original = numberFormatAsRenderText('0.000002', {
      formatter: 'price',
      formatterOptions: { currency: '₿' },
    });
    expect(Array.isArray(original)).toBe(true);
    expect(actual.textSegments).toEqual(
      Array.isArray(original)
        ? original.map((part) =>
            typeof part === 'string'
              ? { text: part }
              : { text: String(part.value), style: 'subscript' },
          )
        : undefined,
    );
    expect(actual.textSegments).toContainEqual({
      text: '5',
      style: 'subscript',
    });
  });

  it('does not serialize hidden money in either text or native text segments', () => {
    mockHideValue = true;
    mockCurrency = 'btc';
    const { result } = renderHook(() => useNetworkListPresentationV2('usd'));
    expect(result.current.formatCurrencyValue('1234567.89')).toEqual({
      text: '****',
    });
  });

  it('retains the source unit while the selected currency rate is unavailable', () => {
    mockCurrency = 'eur';
    delete mockCurrencyMap.eur;
    const { result } = renderHook(() => useNetworkListPresentationV2('usd'));
    expect(result.current.formatCurrencyValue('10')).toEqual({
      text: numberFormatAsRenderText('10', {
        formatter: 'price',
        formatterOptions: { currency: '$' },
      }),
    });
  });
});
