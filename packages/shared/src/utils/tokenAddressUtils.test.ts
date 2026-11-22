import networkUtils from './networkUtils';
import {
  caseSensitiveNetworkImpl,
  normalizeTokenContractAddress,
} from './tokenAddressUtils';
import {
  equalTokenNoCaseSensitive,
  normalizeTokenContractAddress as legacyNormalize,
  caseSensitiveNetworkImpl as legacySensitiveNetworks,
} from './tokenUtils';

describe('token address identity', () => {
  it.each(['sol', 'stc', 'tron', 'aptos', 'sui', 'ton'])(
    'preserves case for %s addresses',
    (impl) => {
      expect(
        normalizeTokenContractAddress({
          networkId: `${impl}--1`,
          contractAddress: 'AbC123',
        }),
      ).toBe('AbC123');
    },
  );

  it.each(['evm--1', 'btc--0', 'unknown--1'])(
    'uses the existing lowercase normalization for %s',
    (networkId) => {
      expect(
        normalizeTokenContractAddress({ networkId, contractAddress: 'AbC123' }),
      ).toBe('abc123');
    },
  );

  it.each([
    ['', { impl: '', chainId: undefined }],
    ['sol', { impl: 'sol', chainId: undefined }],
    ['evm--1--extra', { impl: 'evm', chainId: '1' }],
  ])(
    'preserves the network ID parsing contract for %s',
    (networkId, expected) => {
      expect(networkUtils.parseNetworkId({ networkId })).toEqual(expected);
    },
  );

  it('compares token identities using both network and address rules', () => {
    expect(
      equalTokenNoCaseSensitive({
        token1: { networkId: 'evm--1', contractAddress: '0xAbC' },
        token2: { networkId: 'evm--1', contractAddress: '0xaBc' },
      }),
    ).toBe(true);
    expect(
      equalTokenNoCaseSensitive({
        token1: { networkId: 'sol--101', contractAddress: 'AbC' },
        token2: { networkId: 'sol--101', contractAddress: 'aBc' },
      }),
    ).toBe(false);
    expect(
      equalTokenNoCaseSensitive({
        token1: { networkId: 'evm--1', contractAddress: '0xabc' },
        token2: { networkId: 'evm--10', contractAddress: '0xabc' },
      }),
    ).toBe(false);
    expect(
      equalTokenNoCaseSensitive({
        token1: undefined,
        token2: { networkId: 'evm--1' },
      }),
    ).toBe(false);
  });

  it('preserves undefined and keeps existing exports bound to the same rules', () => {
    expect(
      normalizeTokenContractAddress({
        networkId: 'evm--1',
        contractAddress: undefined,
      }),
    ).toBeUndefined();
    expect(legacyNormalize).toBe(normalizeTokenContractAddress);
    expect(legacySensitiveNetworks).toBe(caseSensitiveNetworkImpl);
    expect(networkUtils.parseNetworkId({ networkId: 'sol--101' })).toEqual({
      impl: 'sol',
      chainId: '101',
    });
  });
});
