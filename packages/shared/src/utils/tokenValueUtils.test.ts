import {
  UNAVAILABLE_DISPLAY,
  displayOrUnavailable,
  isValidNumberValue,
  tokenGroupsHaveUnavailable,
  tokenMapHasUnavailable,
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

describe('tokenMapHasUnavailable', () => {
  test('returns false for an empty or missing map', () => {
    expect(tokenMapHasUnavailable(undefined)).toBe(false);
    expect(tokenMapHasUnavailable({})).toBe(false);
  });

  test('returns false when every entry has valid fiat and balance', () => {
    expect(
      tokenMapHasUnavailable({
        a: { fiatValue: '0', balanceParsed: '0' },
        b: { fiatValue: '12.34', balanceParsed: '1' },
      }),
    ).toBe(false);
  });

  test('returns true when any entry has null fiatValue', () => {
    expect(
      tokenMapHasUnavailable({
        a: { fiatValue: '12.34', balanceParsed: '1' },
        b: { fiatValue: null, balanceParsed: '5' },
      }),
    ).toBe(true);
  });

  test('returns true when any entry has null balanceParsed', () => {
    expect(
      tokenMapHasUnavailable({
        a: { fiatValue: '12.34', balanceParsed: null },
      }),
    ).toBe(true);
  });

  test('returns true when any entry has undefined fields', () => {
    expect(tokenMapHasUnavailable({ a: {} })).toBe(true);
  });

  test('skips empty entries without crashing', () => {
    expect(
      tokenMapHasUnavailable({
        a: undefined,
        b: { fiatValue: '1', balanceParsed: '1' },
      }),
    ).toBe(false);
  });

  test('flags NaN values as unavailable', () => {
    expect(
      tokenMapHasUnavailable({
        a: { fiatValue: 'NaN', balanceParsed: '1' },
      }),
    ).toBe(true);
  });
});

describe('tokenGroupsHaveUnavailable', () => {
  test('returns false when both maps are fully populated', () => {
    expect(
      tokenGroupsHaveUnavailable({
        tokens: { map: { a: { fiatValue: '1', balanceParsed: '1' } } },
        smallBalanceTokens: {
          map: { b: { fiatValue: '0.1', balanceParsed: '1' } },
        },
      }),
    ).toBe(false);
  });

  test('returns true when smallBalanceTokens has an unavailable entry', () => {
    expect(
      tokenGroupsHaveUnavailable({
        tokens: { map: { a: { fiatValue: '1', balanceParsed: '1' } } },
        smallBalanceTokens: {
          map: { b: { fiatValue: null, balanceParsed: '1' } },
        },
      }),
    ).toBe(true);
  });

  test('handles missing token group shapes', () => {
    expect(tokenGroupsHaveUnavailable({})).toBe(false);
  });
});
