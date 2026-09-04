/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useMarketDetailDisplayData } from './useMarketDetailDisplayData';

const mockTokenDetailData = {
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
});
