import {
  formatUnifoldRouteAssetDescription,
  formatUnifoldTokenAmount,
  isUnifoldNativeTokenAddress,
  normalizeUnifoldExplorerUrl,
} from './unifoldFormat';

describe('normalizeUnifoldExplorerUrl', () => {
  it.each([
    ['https://arbiscan.io/tx/0x123', 'https://arbiscan.io/tx/0x123'],
    ['  HTTPS://arbiscan.io/tx/0x123  ', 'HTTPS://arbiscan.io/tx/0x123'],
  ])('allows an absolute HTTPS explorer URL', (input, expected) => {
    expect(normalizeUnifoldExplorerUrl(input)).toBe(expected);
  });

  it.each([
    'http://arbiscan.io/tx/0x123',
    ['java', 'script:alert(1)'].join(''),
    'onekey-wallet://open',
    'file:///tmp/transaction',
    'arbiscan.io/tx/0x123',
    'https://',
    '',
    '   ',
  ])('rejects a non-HTTPS or invalid explorer URL: %s', (input) => {
    expect(normalizeUnifoldExplorerUrl(input)).toBeNull();
  });

  it('rejects missing explorer URLs', () => {
    expect(normalizeUnifoldExplorerUrl(null)).toBeNull();
    expect(normalizeUnifoldExplorerUrl(undefined)).toBeNull();
  });
});

describe('Unifold destination labels', () => {
  it('uses the standard numeric placeholder for a missing amount', () => {
    expect(
      formatUnifoldTokenAmount({
        baseUnit: null,
        decimals: 6,
        currency: 'usdc',
      }),
    ).toBe('--');
  });

  it('preserves the HyperCore account suffix in received amounts', () => {
    expect(
      formatUnifoldTokenAmount({
        baseUnit: '12340000',
        decimals: 6,
        currency: 'USDC (Perp)',
      }),
    ).toBe('12.34 USDC (Perp)');
  });

  it('keeps ordinary vendor currency normalization', () => {
    expect(
      formatUnifoldTokenAmount({
        baseUnit: '12340000',
        decimals: 6,
        currency: 'usdc',
      }),
    ).toBe('12.34 USDC');
  });

  it('does not append a second parenthetical destination', () => {
    expect(
      formatUnifoldRouteAssetDescription({
        tokenSymbol: 'USDC (Perp)',
        networkName: 'HyperCore',
      }),
    ).toBe('USDC (Perp)');
    expect(
      formatUnifoldRouteAssetDescription({
        tokenSymbol: 'USDC',
        networkName: 'Arbitrum',
      }),
    ).toBe('USDC (Arbitrum)');
  });
});

describe('isUnifoldNativeTokenAddress', () => {
  it.each(['native', ' NATIVE '])(
    'recognizes the Unifold native-token marker: %s',
    (tokenAddress) => {
      expect(isUnifoldNativeTokenAddress(tokenAddress)).toBe(true);
    },
  );

  it.each(['0x1234', '', '   ', null, undefined])(
    'does not treat a contract address or missing value as native: %s',
    (tokenAddress) => {
      expect(isUnifoldNativeTokenAddress(tokenAddress)).toBe(false);
    },
  );
});
