import {
  assertUnifoldEchoMatches,
  formatUnifoldTokenAmountValue,
  formatUnifoldUsdAmount,
} from './unifoldDepositUtils';

describe('formatUnifoldUsdAmount', () => {
  it('trims full-precision vendor strings to 2 decimals', () => {
    // Real payload seen on a live Arbitrum deposit.
    expect(formatUnifoldUsdAmount('3.29960100000000000000')).toBe('$3.30');
    expect(formatUnifoldUsdAmount('2.00')).toBe('$2.00');
    // Large amounts are grouped so they stay readable in the status card.
    expect(formatUnifoldUsdAmount('1234.5678')).toBe('$1,234.57');
    expect(formatUnifoldUsdAmount('999999999.999999')).toBe(
      '$1,000,000,000.00',
    );
  });

  it('renders an em dash for null/empty/non-numeric (never 0)', () => {
    expect(formatUnifoldUsdAmount(null)).toBe('—');
    expect(formatUnifoldUsdAmount(undefined)).toBe('—');
    expect(formatUnifoldUsdAmount('')).toBe('—');
    expect(formatUnifoldUsdAmount('abc')).toBe('—');
  });

  it('puts the sign outside the currency symbol', () => {
    expect(formatUnifoldUsdAmount('-3.5')).toBe('-$3.50');
    expect(formatUnifoldUsdAmount('-0.0000001')).toBe('>-$0.01');
  });

  it('keeps sub-cent amounts visible instead of rounding them to zero', () => {
    expect(formatUnifoldUsdAmount('0.0000001')).toBe('<$0.01');
    expect(formatUnifoldUsdAmount('0')).toBe('$0.00');
  });
});

const REQUEST = {
  recipientAddress: '0x8dE690000000000000000000000000003c8eb0aa',
  destinationChainType: 'ethereum',
  destinationChainId: '1337',
  destinationTokenAddress: '0x00000000000000000000000000000000',
};

const MATCHING_ECHO = { ...REQUEST };

describe('assertUnifoldEchoMatches', () => {
  it('passes on an exact echo', () => {
    expect(() =>
      assertUnifoldEchoMatches(MATCHING_ECHO, REQUEST),
    ).not.toThrow();
  });

  it('ignores address casing differences', () => {
    expect(() =>
      assertUnifoldEchoMatches(
        {
          ...MATCHING_ECHO,
          recipientAddress: REQUEST.recipientAddress.toUpperCase(),
          destinationTokenAddress:
            REQUEST.destinationTokenAddress.toUpperCase(),
        },
        REQUEST,
      ),
    ).not.toThrow();
  });

  it.each([
    [
      'recipientAddress',
      { recipientAddress: '0x0000000000000000000000000000000000000bad' },
    ],
    ['destinationChainType', { destinationChainType: 'solana' }],
    ['destinationChainId', { destinationChainId: '1' }],
    [
      'destinationTokenAddress',
      { destinationTokenAddress: '0x6d1e0000000000000000000000000000' },
    ],
  ])('throws when %s differs', (_field, override) => {
    expect(() =>
      assertUnifoldEchoMatches({ ...MATCHING_ECHO, ...override }, REQUEST),
    ).toThrow('echo mismatch');
  });

  it('throws on missing echo or empty fields (fail-closed)', () => {
    expect(() => assertUnifoldEchoMatches(undefined, REQUEST)).toThrow();
    expect(() => assertUnifoldEchoMatches(null, REQUEST)).toThrow();
    expect(() =>
      assertUnifoldEchoMatches(
        { ...MATCHING_ECHO, recipientAddress: '' },
        REQUEST,
      ),
    ).toThrow();
  });
});

describe('formatUnifoldTokenAmountValue', () => {
  const fmt = (baseUnit: string | null, decimals: number | null) =>
    formatUnifoldTokenAmountValue({ baseUnit, decimals });

  it('groups thousands and keeps 2dp for values >= 1', () => {
    expect(fmt('3300000', 6)).toBe('3.30');
    expect(fmt('123456789012345678', 6)).toBe('123,456,789,012.35');
  });

  it('never collapses a non-zero balance to a bare 0', () => {
    // 1 wei of an 18-decimal token used to render as "0".
    expect(fmt('1', 18)).toBe('<0.00000001');
    expect(fmt('1', 6)).toBe('0.000001');
  });

  it('renders a genuine zero and missing inputs distinctly', () => {
    expect(fmt('0', 6)).toBe('0');
    expect(fmt(null, 6)).toBeNull();
    expect(fmt('3300000', null)).toBeNull();
  });
});
