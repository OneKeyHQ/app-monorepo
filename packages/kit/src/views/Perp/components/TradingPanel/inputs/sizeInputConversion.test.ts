import {
  canSkipPerpsSizePriceConversion,
  convertPerpsSizeDisplayValueToToken,
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
