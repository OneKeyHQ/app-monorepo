import { resolveNetworkLogoUri } from './useNetworkLogoUri.utils';

describe('resolveNetworkLogoUri', () => {
  it('keeps a fetched logo only while it belongs to the active network', () => {
    const fetchedLogo = {
      logoUri: 'https://example.com/bsc.png',
      networkId: 'evm--56',
    };

    expect(
      resolveNetworkLogoUri({
        fetchedLogo,
        networkId: 'evm--56',
      }),
    ).toBe('https://example.com/bsc.png');
    expect(
      resolveNetworkLogoUri({
        fetchedLogo,
        networkId: 'evm--1',
      }),
    ).toBe('');
  });

  it('uses an identity-owned logo without waiting for the fallback request', () => {
    expect(
      resolveNetworkLogoUri({
        fetchedLogo: {
          logoUri: 'https://example.com/bsc.png',
          networkId: 'evm--56',
        },
        logoUri: 'https://example.com/eth.png',
        networkId: 'evm--1',
      }),
    ).toBe('https://example.com/eth.png');
  });
});
