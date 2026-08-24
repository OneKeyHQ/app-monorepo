import {
  deleteCachedNetworkLogoUri,
  getCachedNetworkLogoUri,
  resolveNetworkLogoUri,
  setCachedNetworkLogoUri,
} from './useNetworkLogoUri.utils';

describe('resolveNetworkLogoUri', () => {
  afterEach(() => {
    deleteCachedNetworkLogoUri('evm--1');
    deleteCachedNetworkLogoUri('evm--56');
  });

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

  it('makes a completed identity lookup synchronously available to new consumers', () => {
    setCachedNetworkLogoUri({
      logoUri: 'https://example.com/eth.png',
      networkId: 'evm--1',
    });

    expect(getCachedNetworkLogoUri('evm--1')).toBe(
      'https://example.com/eth.png',
    );
    expect(
      resolveNetworkLogoUri({
        cachedLogoUri: getCachedNetworkLogoUri('evm--1'),
        fetchedLogo: { logoUri: '' },
        networkId: 'evm--1',
      }),
    ).toBe('https://example.com/eth.png');
  });

  it('does not treat a cached Promise without a completed value as a sync hit', () => {
    expect(
      resolveNetworkLogoUri({
        cachedLogoUri: getCachedNetworkLogoUri('evm--1'),
        fetchedLogo: { logoUri: '' },
        networkId: 'evm--1',
      }),
    ).toBe('');
  });

  it('keeps the last-good identity URL while revalidation returns empty', () => {
    setCachedNetworkLogoUri({
      logoUri: 'https://example.com/eth.png',
      networkId: 'evm--1',
    });

    expect(
      resolveNetworkLogoUri({
        cachedLogoUri: getCachedNetworkLogoUri('evm--1'),
        fetchedLogo: { logoUri: '', networkId: 'evm--1' },
        networkId: 'evm--1',
      }),
    ).toBe('https://example.com/eth.png');
  });

  it('never reads the previous identity URL after a network switch', () => {
    setCachedNetworkLogoUri({
      logoUri: 'https://example.com/eth.png',
      networkId: 'evm--1',
    });

    expect(
      resolveNetworkLogoUri({
        cachedLogoUri: getCachedNetworkLogoUri('evm--56'),
        fetchedLogo: {
          logoUri: 'https://example.com/eth.png',
          networkId: 'evm--1',
        },
        networkId: 'evm--56',
      }),
    ).toBe('');
  });
});
