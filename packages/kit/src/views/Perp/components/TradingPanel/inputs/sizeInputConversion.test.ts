import { isTwapTotalNotionalValid } from '@onekeyhq/shared/src/utils/hyperliquidTwapUtils';

import {
  canSkipPerpsSizePriceConversion,
  convertPerpsSizeDisplayValueToToken,
  getPerpsMinimumOrderSuggestion,
} from './sizeInputConversion';

describe('perps size price-change conversion gate', () => {
  it('skips when nothing has been entered at all', () => {
    expect(
      canSkipPerpsSizePriceConversion({
        tokenValue: '',
        inputMode: 'usd',
        usdAmount: '',
        marginAmount: '',
      }),
    ).toBe(true);
  });

  it('skips in token mode, where the typed value is already the token size', () => {
    expect(
      canSkipPerpsSizePriceConversion({
        tokenValue: '',
        inputMode: 'token',
        usdAmount: '250',
        marginAmount: '25',
      }),
    ).toBe(true);
  });

  // OK-58621: a USD amount typed while the price was empty has no token value
  // yet, so it must still convert once the price is entered.
  it('does not skip a pending USD amount that never converted', () => {
    expect(
      canSkipPerpsSizePriceConversion({
        tokenValue: '',
        inputMode: 'usd',
        usdAmount: '250',
        marginAmount: '',
      }),
    ).toBe(false);
  });

  it('does not skip a pending margin amount that never converted', () => {
    expect(
      canSkipPerpsSizePriceConversion({
        tokenValue: '',
        inputMode: 'margin',
        usdAmount: '',
        marginAmount: '25',
      }),
    ).toBe(false);
  });

  it('does not skip once a token value exists', () => {
    expect(
      canSkipPerpsSizePriceConversion({
        tokenValue: '0.5',
        inputMode: 'usd',
        usdAmount: '',
        marginAmount: '',
      }),
    ).toBe(false);
  });
});

describe('perps size input conversion', () => {
  it('converts USD order size to a target-market token size', () => {
    expect(
      convertPerpsSizeDisplayValueToToken({
        displayValue: '100',
        inputMode: 'usd',
        referencePrice: '1843.5',
        leverage: 10,
        szDecimals: 4,
      }),
    ).toBe('0.0542');
  });

  it('converts USD order cost using the position leverage', () => {
    expect(
      convertPerpsSizeDisplayValueToToken({
        displayValue: '10',
        inputMode: 'margin',
        referencePrice: '1843.5',
        leverage: 10,
        szDecimals: 4,
      }),
    ).toBe('0.0542');
  });

  it('rejects conversion without a valid reference price', () => {
    expect(
      convertPerpsSizeDisplayValueToToken({
        displayValue: '10',
        inputMode: 'margin',
        referencePrice: '0',
        leverage: 10,
        szDecimals: 4,
      }),
    ).toBe('');
  });
});

describe('minimum order suggestions by input unit', () => {
  it.each([
    { minimumNotional: 10, inputMode: 'usd' as const, label: '$10.57' },
    { minimumNotional: 10, inputMode: 'margin' as const, label: '$1.06' },
    { minimumNotional: 10, inputMode: 'token' as const, label: '0.00013 BTC' },
    { minimumNotional: 100, inputMode: 'usd' as const, label: '$100.82' },
    { minimumNotional: 100, inputMode: 'margin' as const, label: '$10.09' },
    { minimumNotional: 100, inputMode: 'token' as const, label: '0.00124 BTC' },
  ])(
    'formats $minimumNotional notional in $inputMode',
    ({ minimumNotional, inputMode, label }) => {
      expect(
        getPerpsMinimumOrderSuggestion({
          price: '81300',
          szDecimals: 5,
          minimumNotional,
          inputMode,
          leverage: 10,
          symbol: 'BTC',
        })?.label,
      ).toBe(label);
    },
  );

  it.each([1, 10, 20, 40])(
    'suggests sufficient TWAP cost at %s times leverage',
    (leverage) => {
      const suggestion = getPerpsMinimumOrderSuggestion({
        price: '81300',
        szDecimals: 5,
        minimumNotional: 100,
        inputMode: 'margin',
        leverage,
        symbol: 'BTC',
      });
      expect(suggestion).toBeDefined();
      const size = convertPerpsSizeDisplayValueToToken({
        displayValue: suggestion?.displayValue ?? '',
        inputMode: 'margin',
        referencePrice: '81300',
        leverage,
        szDecimals: 5,
      });
      expect(
        isTwapTotalNotionalValid({ size, price: '81300', szDecimals: 5 }),
      ).toBe(true);
    },
  );
});
