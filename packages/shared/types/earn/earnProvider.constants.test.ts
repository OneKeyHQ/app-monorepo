import {
  isSupportStaking,
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from './earnProvider.constants';

describe('Bitway Earn provider constants', () => {
  it('normalizes the provider name used by Earn routes', () => {
    expect(normalizeToEarnProvider('bitway')).toBe('Bitway');
    expect(normalizeToEarnProvider('BITWAY')).toBe('Bitway');
  });

  it('normalizes the Bitway U symbol', () => {
    const input = 'u';
    const expected = 'U';
    expect(normalizeToEarnSymbol(input)).toBe(expected);
  });

  it('exposes the U Market token as Earn-capable', () => {
    expect(isSupportStaking('U')).toBe(true);
  });
});
