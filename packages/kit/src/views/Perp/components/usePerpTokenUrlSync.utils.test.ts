import {
  decodeCoinFromUrl,
  encodeCoinForUrl,
} from './usePerpTokenUrlSync.utils';

describe('encodeCoinForUrl', () => {
  it('keeps the dex separator for sub-DEX coins', () => {
    expect(encodeCoinForUrl({ coin: 'xyz:NVDA', mode: 'perp' })).toBe(
      'xyz:NVDA',
    );
    expect(encodeCoinForUrl({ coin: 'io:AAPL', mode: 'perp' })).toBe('io:AAPL');
  });

  it('leaves a main-DEX symbol that starts with a dex prefix untouched', () => {
    expect(encodeCoinForUrl({ coin: 'IOTA', mode: 'perp' })).toBe('IOTA');
    expect(encodeCoinForUrl({ coin: 'IO', mode: 'perp' })).toBe('IO');
  });
});

describe('decodeCoinFromUrl', () => {
  it('splits a separator-bearing link without guessing', () => {
    expect(decodeCoinFromUrl('io:AAPL')).toEqual({
      coin: 'io:AAPL',
      isAmbiguousLegacyGuess: false,
      unverifiedFallbackCoin: 'io:AAPL',
    });
  });

  it('trusts the xyz bare-prefix guess when the universe is unavailable', () => {
    // xyz is what separator-free links were minted for, and no main-DEX symbol
    // shadows it, so the guess is the only reading that names a market.
    expect(decodeCoinFromUrl('xyzNVDA')).toEqual({
      coin: 'xyz:NVDA',
      isAmbiguousLegacyGuess: true,
      unverifiedFallbackCoin: 'xyz:NVDA',
    });
  });

  it('falls back to the literal token for a prefix a main-DEX symbol shadows', () => {
    // `io` shadows the real main-DEX IOTA market; without a universe to
    // confirm `io:TA`, the literal reading is the right one.
    expect(decodeCoinFromUrl('IOTA')).toEqual({
      coin: 'io:TA',
      isAmbiguousLegacyGuess: true,
      unverifiedFallbackCoin: 'IOTA',
    });
  });

  it('keeps the guess for an unshadowed prefix, whatever its link history', () => {
    // No main-DEX symbol starts with `para`, so the literal reading names no
    // market at all and the split guess is the only one that can resolve.
    expect(decodeCoinFromUrl('paraUNITREE')).toEqual({
      coin: 'para:UNITREE',
      isAmbiguousLegacyGuess: true,
      unverifiedFallbackCoin: 'para:UNITREE',
    });
  });

  it('leaves a token equal to a dex prefix as a main-DEX coin', () => {
    expect(decodeCoinFromUrl('IO')).toEqual({
      coin: 'IO',
      isAmbiguousLegacyGuess: false,
      unverifiedFallbackCoin: 'IO',
    });
  });

  it('leaves an unregistered prefix alone', () => {
    expect(decodeCoinFromUrl('BTC')).toEqual({
      coin: 'BTC',
      isAmbiguousLegacyGuess: false,
      unverifiedFallbackCoin: 'BTC',
    });
  });
});
