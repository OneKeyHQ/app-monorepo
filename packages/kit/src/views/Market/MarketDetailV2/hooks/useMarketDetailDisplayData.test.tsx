/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type {
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import {
  preserveMarketDetailPreviewImage,
  useMarketDetailDisplayData,
} from './useMarketDetailDisplayData';

const mockTokenDetailData: {
  tokenDetail: IMarketTokenDetail | undefined;
  tokenDetailPreview: IMarketTokenDetailPreview | undefined;
  isLoading: boolean;
  tokenAddress: string;
  networkId: string;
  isNative: boolean;
  websocketConfig: undefined;
  perpsInfo: undefined;
  isReady: boolean;
  isStockToken: boolean;
} = {
  tokenDetail: undefined,
  tokenDetailPreview: undefined,
  isLoading: false,
  tokenAddress: '',
  networkId: '',
  isNative: false,
  websocketConfig: undefined,
  perpsInfo: undefined,
  isReady: false,
  isStockToken: true,
};
let mockStockPreview:
  | {
      stockId: string;
      symbol: string;
      name: string;
      logoUrl: string;
    }
  | undefined;

jest.mock('./useTokenDetail', () => ({
  useTokenDetail: () => mockTokenDetailData,
}));

jest.mock('./StockDetailContext', () => ({
  useStockDetail: () => ({ stockPreview: mockStockPreview }),
}));

describe('useMarketDetailDisplayData', () => {
  beforeEach(() => {
    mockTokenDetailData.tokenDetail = undefined;
    mockTokenDetailData.tokenDetailPreview = undefined;
    mockTokenDetailData.tokenAddress = '';
    mockTokenDetailData.networkId = '';
    mockStockPreview = undefined;
  });

  it('uses a stock route preview before token detail is available', () => {
    mockTokenDetailData.tokenAddress = '0xaapl';
    mockTokenDetailData.networkId = 'evm--1';
    mockStockPreview = {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: 'https://example.com/aapl.png',
    };

    const { result } = renderHook(() => useMarketDetailDisplayData());

    expect(result.current.tokenDetail).toMatchObject({
      address: '0xaapl',
      networkId: 'evm--1',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: 'https://example.com/aapl.png',
      decimalsResolved: false,
    });
    expect(result.current.isPreviewTokenDetail).toBe(true);
    expect(result.current.isStockToken).toBe(true);
  });

  it('prefers a new preview over a stale full token detail', () => {
    mockTokenDetailData.tokenAddress =
      '0x0000000000000000000000000000000000000002';
    mockTokenDetailData.networkId = 'evm--1';
    mockTokenDetailData.tokenDetail = {
      address: '0x0000000000000000000000000000000000000001',
      networkId: 'evm--1',
      symbol: 'OLD',
      name: 'Old Token',
      decimals: 18,
      logoUrl: 'https://example.com/old.png',
    } as IMarketTokenDetail;
    mockTokenDetailData.tokenDetailPreview = {
      address: '0x0000000000000000000000000000000000000002',
      networkId: 'evm--1',
      symbol: 'NEW',
      name: 'New Token',
      decimals: 18,
      tokenImageUri: 'https://example.com/new.png',
      selectedAt: 1,
    };

    const { result } = renderHook(() => useMarketDetailDisplayData());

    expect(result.current.tokenDetail).toMatchObject({
      address: '0x0000000000000000000000000000000000000002',
      symbol: 'NEW',
      logoUrl: 'https://example.com/new.png',
    });
    expect(result.current.isPreviewTokenDetail).toBe(true);
  });
});

describe('preserveMarketDetailPreviewImage', () => {
  const previewTokenDetail: IMarketTokenDetail = {
    address: '0xmarket',
    decimals: 18,
    isNative: false,
    logoUrl: 'https://example.com/preview.png',
    name: 'Market Token',
    networkId: 'evm--56',
    symbol: 'MARKET',
  };
  const tokenDetail: IMarketTokenDetail = {
    ...previewTokenDetail,
    logoUrl: previewTokenDetail.logoUrl,
    logoUrls: [
      previewTokenDetail.logoUrl,
      'https://example.com/detail-fallback.png',
    ],
    price: '1.23',
  };

  it('keeps the already-visible preview source when full detail arrives', () => {
    expect(
      preserveMarketDetailPreviewImage({
        previewTokenDetail,
        tokenDetail,
      }),
    ).toEqual({
      ...tokenDetail,
      logoUrl: previewTokenDetail.logoUrl,
      logoUrls: undefined,
    });
  });

  it('treats an empty native address and a CoinGecko id as the same token', () => {
    const btcPreview: IMarketTokenDetail = {
      ...previewTokenDetail,
      address: 'bitcoin',
      networkId: 'btc--0',
      isNative: false,
    };
    const btcDetail: IMarketTokenDetail = {
      ...tokenDetail,
      address: '',
      networkId: 'btc--0',
      isNative: true,
    };

    expect(
      preserveMarketDetailPreviewImage({
        previewTokenDetail: btcPreview,
        tokenDetail: btcDetail,
      }),
    ).toEqual({
      ...btcDetail,
      logoUrl: btcPreview.logoUrl,
      logoUrls: btcPreview.logoUrls,
    });
  });

  it('does not reuse a preview source for another token identity', () => {
    expect(
      preserveMarketDetailPreviewImage({
        previewTokenDetail: {
          ...previewTokenDetail,
          address: '0xother',
        },
        tokenDetail,
      }),
    ).toBe(tokenDetail);
  });

  it('uses full-detail images when the preview has no image source', () => {
    expect(
      preserveMarketDetailPreviewImage({
        previewTokenDetail: {
          ...previewTokenDetail,
          logoUrl: '',
        },
        tokenDetail,
      }),
    ).toBe(tokenDetail);
  });

  it('uses a corrected full-detail image when it no longer confirms the preview', () => {
    const correctedTokenDetail = {
      ...tokenDetail,
      logoUrl: 'https://example.com/corrected.png',
      logoUrls: ['https://example.com/corrected.png'],
    };

    expect(
      preserveMarketDetailPreviewImage({
        previewTokenDetail,
        tokenDetail: correctedTokenDetail,
      }),
    ).toBe(correctedTokenDetail);
  });
});
