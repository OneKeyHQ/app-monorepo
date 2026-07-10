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

  it.each([
    ['u', 'U'],
    ['btw', 'BTW'],
    ['usd1', 'USD1'],
  ])('normalizes the Bitway symbol %s to %s', (input, expected) => {
    expect(normalizeToEarnSymbol(input)).toBe(expected);
  });

  it.each(['U', 'BTW', 'USD1'])(
    'exposes the %s Market token as Earn-capable',
    (symbol) => {
      expect(isSupportStaking(symbol)).toBe(true);
    },
  );
});
