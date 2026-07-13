import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { mergeOneKeyLimitOrderTokenMetadata } from './swapLimitOrderUtils';

const providerToken = {
  networkId: 'evm--1',
  contractAddress: '0x123',
  decimals: 18,
  logoURI: 'https://cow.example/token.png',
  name: 'Cow Token',
  symbol: 'COW',
} as ISwapToken;

describe('mergeOneKeyLimitOrderTokenMetadata', () => {
  it('uses OneKey display metadata without changing order token identity', () => {
    expect(
      mergeOneKeyLimitOrderTokenMetadata({
        providerToken,
        oneKeyToken: {
          logoURI: 'https://onekey.example/token.png',
          name: 'OneKey Token',
          symbol: 'ONE',
        },
      }),
    ).toEqual({
      ...providerToken,
      logoURI: 'https://onekey.example/token.png',
      name: 'OneKey Token',
      symbol: 'ONE',
    });
  });

  it('keeps provider fields when OneKey metadata is unavailable', () => {
    expect(
      mergeOneKeyLimitOrderTokenMetadata({
        providerToken,
        oneKeyToken: null,
      }),
    ).toBe(providerToken);
  });
});
