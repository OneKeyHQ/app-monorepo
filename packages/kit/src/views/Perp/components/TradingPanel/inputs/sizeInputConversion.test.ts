import { convertPerpsSizeDisplayValueToToken } from './sizeInputConversion';

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
