import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildStockPositionsMetadataScope,
  getStockPositionTokenIdentityKeys,
  getStockPositionsMetadataViewState,
  isStockPositionsMetadataResponseComplete,
  shouldUseSwapProPositionsDisplaySeed,
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

  it('keeps a persisted positions snapshot display-only until live data owns the list', () => {
    expect(
      shouldUseSwapProPositionsDisplaySeed({
        hasCachedTokenSnapshot: true,
        isLiveTokenListForCurrentOwner: false,
      }),
    ).toBe(true);
    expect(
      shouldUseSwapProPositionsDisplaySeed({
        hasCachedTokenSnapshot: true,
        isLiveTokenListForCurrentOwner: true,
      }),
    ).toBe(false);
  });

  it('rejects a partial metadata response instead of classifying missing assets as non-stock', () => {
    expect(
      isStockPositionsMetadataResponseComplete({
        marketItems: [{ stock: {} }],
        tokens: [ethToken, bnbToken],
      }),
    ).toBe(false);
    expect(
      isStockPositionsMetadataResponseComplete({
        marketItems: [{ stock: {} }, {}],
        tokens: [ethToken, bnbToken],
      }),
    ).toBe(true);
  });

  it('shows loading before the first Stock metadata request settles', () => {
    expect(
      getStockPositionsMetadataViewState({
        isStockMetadataLoading: true,
        hasUsableMetadata: false,
        stockOnly: true,
      }),
    ).toBe('loading');
  });

  it('shows an actionable error instead of No results after the initial request fails', () => {
    expect(
      getStockPositionsMetadataViewState({
        isStockMetadataLoading: false,
        metadataStatus: 'error',
        hasUsableMetadata: false,
        stockOnly: true,
      }),
    ).toBe('error');
  });

  it('keeps resolved Stock positions visible during refresh', () => {
    expect(
      getStockPositionsMetadataViewState({
        isStockMetadataLoading: true,
        metadataStatus: 'success',
        hasUsableMetadata: true,
        stockOnly: true,
      }),
    ).toBe('success');
  });

  it('keeps same-scope last-good metadata visible after a refresh error', () => {
    expect(
      getStockPositionsMetadataViewState({
        isStockMetadataLoading: false,
        metadataStatus: 'error',
        hasUsableMetadata: true,
        stockOnly: true,
      }),
    ).toBe('success');
  });
});
