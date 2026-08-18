/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { NativeMarketTradingViewWarmup } from './NativeMarketTradingViewWarmup.native';

const mockRequestWarmup = jest.fn();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));

jest.mock(
  '../../MarketDetailV2/components/NativePersistentMarketTradingView/nativeMarketTradingViewHostStore',
  () => ({
    getNativeMarketTradingViewWarmupGeneration: () => 7,
    requestNativeMarketTradingViewWarmup: (warmupGeneration: number) => {
      mockRequestWarmup(warmupGeneration);
    },
  }),
);

jest.mock(
  '../../MarketDetailV2/utils/nativeMarketTradingViewPreloadPolicy',
  () => ({
    getNativeMarketTradingViewPreloadPolicy: () => ({
      enabled: true,
      delayMs: 600,
    }),
  }),
);

jest.mock(
  '../../MarketDetailV2/utils/marketTradingViewResolutionPreference',
  () => ({
    hydrateMarketTradingViewPreferences: jest.fn(() => Promise.resolve()),
  }),
);

describe('NativeMarketTradingViewWarmup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRequestWarmup.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requests the persistent host after the device-tier delay', async () => {
    render(<NativeMarketTradingViewWarmup enabled />);

    expect(mockRequestWarmup).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockRequestWarmup).toHaveBeenCalledTimes(1);
    expect(mockRequestWarmup).toHaveBeenCalledWith(7);
  });

  it('cancels the pending warmup when the market page loses focus', async () => {
    const { rerender } = render(<NativeMarketTradingViewWarmup enabled />);
    rerender(<NativeMarketTradingViewWarmup enabled={false} />);

    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockRequestWarmup).not.toHaveBeenCalled();
  });
});
