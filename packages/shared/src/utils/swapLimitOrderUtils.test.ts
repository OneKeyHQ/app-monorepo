import {
  ESwapLimitOrderStatus,
  type IFetchLimitOrderRes,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  mergeLimitOrderTokenDisplayMetadata,
  mergeLimitOrderTokenDisplayMetadataIntoOrder,
} from './swapLimitOrderUtils';

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

  it('keeps the existing token reference when display fields are unchanged', () => {
    expect(
      mergeLimitOrderTokenDisplayMetadata({
        providerToken,
        displayMetadata: providerToken,
      }),
    ).toBe(providerToken);
  });
});

describe('mergeLimitOrderTokenDisplayMetadataIntoOrder', () => {
  it('merges display fields without overwriting current order state', () => {
    const currentOrder = {
      orderId: 'order-1',
      status: ESwapLimitOrderStatus.FULFILLED,
      executedBuyAmount: '200',
      fromTokenInfo: providerToken,
      toTokenInfo: {
        ...providerToken,
        contractAddress: '0x456',
        symbol: 'TO',
      },
    } as IFetchLimitOrderRes;
    const metadataOrder = {
      ...currentOrder,
      status: ESwapLimitOrderStatus.OPEN,
      executedBuyAmount: '0',
      fromTokenInfo: {
        ...providerToken,
        logoURI: 'https://onekey.example/token.png',
        name: 'OneKey Token',
        symbol: 'ONE',
      },
    };

    expect(
      mergeLimitOrderTokenDisplayMetadataIntoOrder({
        currentOrder,
        metadataOrder,
      }),
    ).toMatchObject({
      status: ESwapLimitOrderStatus.FULFILLED,
      executedBuyAmount: '200',
      fromTokenInfo: {
        logoURI: 'https://onekey.example/token.png',
        name: 'OneKey Token',
        symbol: 'ONE',
      },
    });
  });

  it('ignores stale metadata for a different token identity', () => {
    const currentOrder = {
      orderId: 'order-1',
      fromTokenInfo: providerToken,
      toTokenInfo: providerToken,
    } as IFetchLimitOrderRes;
    const metadataOrder = {
      ...currentOrder,
      fromTokenInfo: {
        ...providerToken,
        contractAddress: '0x999',
        logoURI: 'https://onekey.example/stale.png',
      },
    };

    expect(
      mergeLimitOrderTokenDisplayMetadataIntoOrder({
        currentOrder,
        metadataOrder,
      }).fromTokenInfo,
    ).toBe(providerToken);
  });
});
