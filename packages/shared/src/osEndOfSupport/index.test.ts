import { isOsVersionBelow, resolveOsEndOfSupportNotice } from '.';

describe('isOsVersionBelow', () => {
  it('compares dotted versions numerically', () => {
    expect(isOsVersionBelow('16.7.10', '17.0')).toBe(true);
    expect(isOsVersionBelow('17', '17.0')).toBe(false);
    expect(isOsVersionBelow('17.0.1', '17.0')).toBe(false);
    expect(isOsVersionBelow('9.3', '10.0')).toBe(true);
  });

  it('compares Android API levels', () => {
    expect(isOsVersionBelow('28', '29')).toBe(true);
    expect(isOsVersionBelow('34', '29')).toBe(false);
  });

  it('tells Windows 10 from Windows 11 by build number', () => {
    expect(isOsVersionBelow('10.0.19045', '10.0.22000')).toBe(true);
    expect(isOsVersionBelow('10.0.22631', '10.0.22000')).toBe(false);
  });

  it('returns undefined for unparsable versions', () => {
    expect(isOsVersionBelow('', '17.0')).toBeUndefined();
    expect(isOsVersionBelow('unknown', '17.0')).toBeUndefined();
  });
});

describe('resolveOsEndOfSupportNotice', () => {
  const rule = { minSupportedVersion: '17.0', minSupportedName: 'iOS 17' };

  it('returns a notice only below the threshold', () => {
    expect(
      resolveOsEndOfSupportNotice({
        platform: 'ios',
        rule,
        currentVersion: '16.7.2',
      }),
    ).toEqual({
      id: 'os-end-of-support:ios:17.0',
      minSupportedName: 'iOS 17',
      learnMoreUrl: undefined,
    });
    expect(
      resolveOsEndOfSupportNotice({
        platform: 'ios',
        rule: { ...rule, learnMoreUrl: 'https://example.com/os' },
        currentVersion: '16.7.2',
      })?.learnMoreUrl,
    ).toBe('https://example.com/os');
    expect(
      resolveOsEndOfSupportNotice({
        platform: 'ios',
        rule,
        currentVersion: '18.1',
      }),
    ).toBeUndefined();
  });

  it('stays off without a rule, platform or readable version', () => {
    expect(
      resolveOsEndOfSupportNotice({
        platform: 'ios',
        rule: undefined,
        currentVersion: '16.0',
      }),
    ).toBeUndefined();
    expect(
      resolveOsEndOfSupportNotice({
        platform: undefined,
        rule,
        currentVersion: '16.0',
      }),
    ).toBeUndefined();
    expect(
      resolveOsEndOfSupportNotice({
        platform: 'ios',
        rule,
        currentVersion: 'unknown',
      }),
    ).toBeUndefined();
  });
});
