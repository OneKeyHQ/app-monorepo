/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { ITradingViewPriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';

import { MarketTradingView } from './MarketTradingView';

const mockApplyChartPriceUpdate = jest.fn();
let mockOnPriceUpdate: (data: ITradingViewPriceUpdateData) => void;

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewV2', () => ({
  TRADING_VIEW_DISABLED_FEATURES: {},
  TradingViewV2: ({
    onPriceUpdate,
  }: {
    onPriceUpdate: typeof mockOnPriceUpdate;
  }) => {
    mockOnPriceUpdate = onPriceUpdate;
    return null;
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: { applyChartPriceUpdate: mockApplyChartPriceUpdate },
  }),
}));

jest.mock('../InformationTabs/hooks/useNetworkAccountAddress', () => ({
  useNetworkAccountAddress: () => ({ accountAddress: undefined }),
}));

jest.mock('./MarketChartFullscreenHeader', () => ({
  MarketChartFullscreenHeader: () => null,
}));

const chartProps = {
  networkId: 'evm--4663',
  tokenAddress: '0x3ba500f1ababbcf0f0247d06d1c56fd7e6c4c09d',
  dataSource: 'websocket' as const,
};

const latestPrice: ITradingViewPriceUpdateData = {
  networkId: chartProps.networkId,
  tokenAddress: chartProps.tokenAddress,
  price: '0.002930',
  timestamp: 1_789_531_200_000,
  interval: '15m',
  source: 'history',
};

describe('MarketTradingView price synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('syncs the latest chart snapshot before the first realtime tick', () => {
    render(<MarketTradingView {...chartProps} />);

    act(() => mockOnPriceUpdate(latestPrice));

    expect(mockApplyChartPriceUpdate).toHaveBeenCalledWith({
      networkId: chartProps.networkId,
      tokenAddress: chartProps.tokenAddress,
      price: '0.002930',
      lastUpdated: latestPrice.timestamp,
    });
  });

  it('continues syncing realtime prices after the initial snapshot', () => {
    render(<MarketTradingView {...chartProps} />);

    act(() => {
      mockOnPriceUpdate(latestPrice);
      mockOnPriceUpdate({
        ...latestPrice,
        source: 'realtime',
        price: 0.003_001,
        timestamp: 1_789_531_204_000,
      });
    });

    expect(mockApplyChartPriceUpdate).toHaveBeenCalledTimes(2);
    expect(mockApplyChartPriceUpdate).toHaveBeenLastCalledWith({
      networkId: chartProps.networkId,
      tokenAddress: chartProps.tokenAddress,
      price: '0.003001',
      lastUpdated: 1_789_531_204_000,
    });
  });

  it.each(['history', 'realtime'] as const)(
    'ignores %s prices when chart price updates are disabled',
    (source) => {
      render(<MarketTradingView {...chartProps} disableChartPriceUpdate />);

      act(() => mockOnPriceUpdate({ ...latestPrice, source }));

      expect(mockApplyChartPriceUpdate).not.toHaveBeenCalled();
    },
  );

  it('ignores prices for another token or network', () => {
    render(<MarketTradingView {...chartProps} />);

    act(() => {
      mockOnPriceUpdate({ ...latestPrice, networkId: 'evm--1' });
      mockOnPriceUpdate({ ...latestPrice, tokenAddress: 'another-token' });
      mockOnPriceUpdate({ ...latestPrice, networkId: undefined });
      mockOnPriceUpdate({ ...latestPrice, tokenAddress: undefined });
    });

    expect(mockApplyChartPriceUpdate).not.toHaveBeenCalled();
  });

  it('ignores invalid chart prices', () => {
    render(<MarketTradingView {...chartProps} />);

    act(() => {
      for (const price of ['', 'invalid', '0', -1, Number.NaN, Infinity]) {
        mockOnPriceUpdate({ ...latestPrice, price });
      }
    });

    expect(mockApplyChartPriceUpdate).not.toHaveBeenCalled();
  });
});
