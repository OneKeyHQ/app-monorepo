/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import {
  getNetworkValueV2,
  preloadNetworkImagesV2,
  useNetworkListPresentationV2,
} from './useNetworkListPresentationV2';

const mockTheme = new Proxy({}, { get: () => ({ val: '#000000' }) });
const mockPreloadImages = jest.fn((_sources: unknown[]) =>
  Promise.resolve(true),
);
let mockHideValue = false;
let mockCurrency = 'usd';
let mockCurrencyMap: Record<string, { unit: string; value: number }> = {};

jest.mock('@onekeyhq/components', () => ({
  Image: {
    preloadImages: (sources: unknown[]) => mockPreloadImages(sources),
  },
  useTheme: () => mockTheme,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: mockCurrencyMap }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: mockCurrency } }],
  useSettingsValuePersistAtom: () => [{ hideValue: mockHideValue }],
}));

describe('network currency presentation V2', () => {
  beforeEach(() => {
    mockPreloadImages.mockClear();
    mockHideValue = false;
    mockCurrency = 'usd';
    mockCurrencyMap = {
      usd: { unit: '$', value: 1 },
      btc: { unit: '₿', value: 0.000_001 },
      eur: { unit: '€', value: 0.8 },
    };
  });

  it('preloads each native network image once at its rendered size', async () => {
    await preloadNetworkImagesV2([
      { id: 'evm--1', logoURI: 'https://example.com/eth.png' },
      { id: 'evm--137', logoURI: 'https://example.com/eth.png' },
      {
        id: 'custom--1',
        logoURI: 'https://example.com/custom.png',
        isCustomNetwork: true,
      },
    ] as IServerNetwork[]);

    expect(mockPreloadImages).toHaveBeenCalledWith([
      {
        uri: 'https://example.com/eth.png',
        width: 32,
        height: 32,
        optimize: true,
        cachePolicy: 'memory-disk',
      },
    ]);
  });

  it('keeps a skeleton visible until a network image is ready', () => {
    const { result } = renderHook(() => useNetworkListPresentationV2('usd'));
    expect(
      result.current.getNetworkLeading({
        id: 'evm--1',
        name: 'Ethereum',
        logoURI: 'https://example.com/eth.png',
      } as IServerNetwork),
    ).toMatchObject({
      image: {
        uri: 'https://example.com/eth.png',
        loadingStrategy: 'skeleton',
      },
    });
  });

  it('ignores missing DeFi entries when summing all networks', () => {
    expect(
      getNetworkValueV2({
        network: {
          id: 'onekeyall--0',
          isAllNetworks: true,
        } as Parameters<typeof getNetworkValueV2>[0]['network'],
        accountNetworkValues: { 'evm--1': '2' },
        accountDeFiOverview: {
          'evm--1': undefined as never,
          'evm--137': { netWorth: 3 },
        },
      }),
    ).toBe('5');
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
