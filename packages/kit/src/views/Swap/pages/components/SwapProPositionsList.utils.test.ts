import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildStockPositionsMetadataScope,
  getStockPositionTokenIdentityKeys,
  shouldRenderStockPositionsSkeleton,
} from './SwapProPositionsList.utils';

const ethToken = {
  networkId: 'evm--1',
  contractAddress: '0xAbC',
  symbol: 'ETH',
} as ISwapToken;
const bnbToken = {
  networkId: 'evm--56',
  contractAddress: '0xDef',
  symbol: 'BNB',
} as ISwapToken;

describe('SwapProPositionsList utils', () => {
  it('builds an order-independent metadata cache scope', () => {
    expect(
      buildStockPositionsMetadataScope({
        locale: 'EN-US',
        tokens: [ethToken, bnbToken],
      }),
    ).toBe(
      buildStockPositionsMetadataScope({
        locale: 'en-us',
        tokens: [bnbToken, ethToken],
      }),
    );
  });

  it('stores stock classification identities instead of balance snapshots', () => {
    expect(
      getStockPositionTokenIdentityKeys({
        marketItems: [{ stock: {} }, {}],
        tokens: [ethToken, bnbToken],
      }),
    ).toEqual(['evm--1:0xabc']);
  });

  it('shows the Stock positions skeleton before the first request settles', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        isStockMetadataLoading: true,
        stockOnly: true,
        stockTokenListResolved: false,
      }),
    ).toBe(true);
  });

  it('stops the skeleton after the initial metadata request fails', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        isStockMetadataLoading: false,
        stockOnly: true,
        stockTokenListResolved: false,
      }),
    ).toBe(false);
  });

  it('keeps resolved Stock positions visible during refresh', () => {
    expect(
      shouldRenderStockPositionsSkeleton({
        isStockMetadataLoading: true,
        stockOnly: true,
        stockTokenListResolved: true,
      }),
    ).toBe(false);
  });
});
