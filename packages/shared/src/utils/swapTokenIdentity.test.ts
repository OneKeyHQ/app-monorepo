import {
  getSwapTokenIdentityKey,
  isSameSwapTokenIdentity,
  isSameSwapTokenPairIdentity,
  isValidSwapTokenIdentity,
} from './swapTokenIdentity';

describe('swapTokenIdentity', () => {
  it('normalizes case-insensitive token contract addresses', () => {
    expect(
      isSameSwapTokenIdentity({
        token1: {
          networkId: 'evm--1',
          contractAddress: '0xAaBb',
        },
        token2: {
          networkId: 'evm--1',
          contractAddress: '0xaabb',
        },
      }),
    ).toBe(true);
  });

  it('does not match a pair when native and incomplete non-native identities share an empty address', () => {
    const native = {
      networkId: 'evm--1',
      contractAddress: '',
      isNative: true,
    };
    const incomplete = { ...native, isNative: false };
    const toToken = {
      networkId: 'evm--1',
      contractAddress: '0xusdc',
      isNative: false,
    };

    expect(
      isSameSwapTokenPairIdentity({
        fromToken1: native,
        fromToken2: incomplete,
        toToken1: toToken,
        toToken2: toToken,
      }),
    ).toBe(false);
  });

  it('distinguishes native assets from incomplete tokens with an empty address', () => {
    const nativeToken = {
      networkId: 'evm--1',
      contractAddress: '',
      isNative: true,
    };
    const tokenWithMissingAddress = {
      networkId: 'evm--1',
      contractAddress: '',
      isNative: false,
    };

    expect(getSwapTokenIdentityKey(nativeToken)).toBe('evm--1::native');
    expect(getSwapTokenIdentityKey(tokenWithMissingAddress)).toBe(
      'evm--1::token',
    );
    expect(
      isSameSwapTokenIdentity({
        token1: nativeToken,
        token2: tokenWithMissingAddress,
      }),
    ).toBe(false);
  });

  it('does not consider two ownerless token descriptors equal', () => {
    expect(isSameSwapTokenIdentity({ token1: {}, token2: {} })).toBe(false);
  });

  it('does not consider two incomplete non-native token descriptors equal', () => {
    const incompleteToken = {
      networkId: 'evm--1',
      contractAddress: '',
      isNative: false,
    };

    expect(
      isSameSwapTokenIdentity({
        token1: incompleteToken,
        token2: { ...incompleteToken },
      }),
    ).toBe(false);
  });

  it('accepts native empty-address assets but rejects incomplete non-native assets', () => {
    expect(
      isValidSwapTokenIdentity({
        networkId: 'evm--1',
        contractAddress: '',
        isNative: true,
      }),
    ).toBe(true);
    expect(
      isValidSwapTokenIdentity({
        networkId: 'evm--1',
        contractAddress: '',
        isNative: false,
      }),
    ).toBe(false);
  });
});
