import {
  UNAVAILABLE_DISPLAY,
  displayOrUnavailable,
  isValidNumberValue,
  sumFiatValuesIgnoringUnavailable,
  sumTokenGroupsFiatValueIgnoringUnavailable,
} from './tokenValueUtils';

describe('isValidNumberValue', () => {
  test('rejects null/undefined/empty string (unavailable sentinels)', () => {
    expect(isValidNumberValue(null)).toBe(false);
    expect(isValidNumberValue(undefined)).toBe(false);
    expect(isValidNumberValue('')).toBe(false);
  });

  test('rejects NaN — would otherwise poison BigNumber aggregates', () => {
    expect(isValidNumberValue(Number.NaN)).toBe(false);
    expect(isValidNumberValue('NaN')).toBe(false);
  });

  test('accepts real zero (string and number)', () => {
    expect(isValidNumberValue('0')).toBe(true);
    expect(isValidNumberValue(0)).toBe(true);
  });

  test('accepts non-zero numeric values', () => {
    expect(isValidNumberValue('1.5')).toBe(true);
    expect(isValidNumberValue('-12.3')).toBe(true);
    expect(isValidNumberValue(42)).toBe(true);
  });
});

describe('displayOrUnavailable', () => {
  test('returns UNAVAILABLE_DISPLAY when value is unavailable', () => {
    expect(displayOrUnavailable(null)).toBe(UNAVAILABLE_DISPLAY);
    expect(displayOrUnavailable(undefined)).toBe(UNAVAILABLE_DISPLAY);
    expect(displayOrUnavailable('')).toBe(UNAVAILABLE_DISPLAY);
  });

  test('passes valid values through unchanged', () => {
    expect(displayOrUnavailable('0')).toBe('0');
    expect(displayOrUnavailable(0)).toBe(0);
    expect(displayOrUnavailable('1.5')).toBe('1.5');
  });
});

describe('sumFiatValuesIgnoringUnavailable', () => {
  test('returns 0 for an empty or missing map', () => {
    expect(sumFiatValuesIgnoringUnavailable(undefined)).toBe('0');
    expect(sumFiatValuesIgnoringUnavailable({})).toBe('0');
  });

  test('sums valid fiat values', () => {
    expect(
      sumFiatValuesIgnoringUnavailable({
        a: { fiatValue: '1.5' },
        b: { fiatValue: '2.25' },
      }),
    ).toBe('3.75');
  });

  test('skips null/undefined/empty/NaN entries', () => {
    expect(
      sumFiatValuesIgnoringUnavailable({
        a: { fiatValue: '10' },
        b: { fiatValue: null },
        c: { fiatValue: undefined },
        d: { fiatValue: '' },
        e: { fiatValue: 'NaN' },
        f: { fiatValue: '5' },
      }),
    ).toBe('15');
  });

  test('skips empty entries without crashing', () => {
    expect(
      sumFiatValuesIgnoringUnavailable({
        a: undefined,
        b: { fiatValue: '7' },
      }),
    ).toBe('7');
  });

  test('returns 0 when every entry is unavailable', () => {
    expect(
      sumFiatValuesIgnoringUnavailable({
        a: { fiatValue: null },
        b: { fiatValue: 'NaN' },
      }),
    ).toBe('0');
  });
});

describe('sumTokenGroupsFiatValueIgnoringUnavailable', () => {
  test('sums tokens.map and smallBalanceTokens.map together', () => {
    expect(
      sumTokenGroupsFiatValueIgnoringUnavailable({
        tokens: { map: { a: { fiatValue: '10' } } },
        smallBalanceTokens: { map: { b: { fiatValue: '0.5' } } },
      }),
    ).toBe('10.5');
  });

  test('produces a partial sum when an entry is unavailable', () => {
    expect(
      sumTokenGroupsFiatValueIgnoringUnavailable({
        tokens: { map: { a: { fiatValue: '10' }, b: { fiatValue: null } } },
        smallBalanceTokens: { map: { c: { fiatValue: '0.25' } } },
      }),
    ).toBe('10.25');
  });

  test('handles missing token group shapes', () => {
    expect(sumTokenGroupsFiatValueIgnoringUnavailable({})).toBe('0');
  });
});
