import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { mergeLimitOrderTokenDisplayMetadata } from './swapLimitOrderUtils';

const providerToken = {
  networkId: 'evm--1',
  contractAddress: '0x123',
  decimals: 18,
  logoURI: 'https://cow.example/token.png',
  name: 'Cow Token',
  symbol: 'COW',
} as ISwapToken;

describe('mergeLimitOrderTokenDisplayMetadata', () => {
  it('uses Market display metadata without changing order token identity', () => {
    expect(
      mergeLimitOrderTokenDisplayMetadata({
        providerToken,
        displayMetadata: {
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

  it('keeps provider fields when Market metadata is unavailable', () => {
    expect(
      mergeLimitOrderTokenDisplayMetadata({
        providerToken,
        displayMetadata: null,
      }),
    ).toBe(providerToken);
  });
});
