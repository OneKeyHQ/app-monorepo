import { getProtocolProviderDisplayName } from './protocolProviderDisplayUtils';

describe('protocolProviderDisplayUtils', () => {
  it('keeps DeFi protocol display names for Aave borrow actions', () => {
    expect(
      getProtocolProviderDisplayName({
        provider: 'aave',
        providerDisplayName: 'Aave',
      }),
    ).toBe('Aave');
  });

  it('humanizes raw provider ids when no display metadata is provided', () => {
    expect(
      getProtocolProviderDisplayName({
        provider: 'aave_v3',
      }),
    ).toBe('Aave V3');
  });

  it('ignores raw provider detail ids before applying DeFi display fallback', () => {
    expect(
      getProtocolProviderDisplayName({
        provider: 'aave',
        providerDetailName: 'aave',
      }),
    ).toBe('Aave');
  });

  it('ignores Unknown display metadata before falling back', () => {
    expect(
      getProtocolProviderDisplayName({
        provider: 'compound-v3',
        providerDisplayName: 'Unknown',
      }),
    ).toBe('Compound V3');
  });

  it('still uses Earn provider names for Earn providers', () => {
    expect(
      getProtocolProviderDisplayName({
        provider: 'lido',
      }),
    ).toBe('Lido');
  });
});
