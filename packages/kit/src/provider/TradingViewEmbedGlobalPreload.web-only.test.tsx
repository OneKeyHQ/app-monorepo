/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { preloadMarketTradingView } from '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView';

import { TradingViewEmbedGlobalPreload } from './TradingViewEmbedGlobalPreload.web-only';

jest.mock('../components/TradingView/hooks/useTradingViewUrl', () => ({
  useTradingViewUrl: () => ({
    baseUrl: 'http://localhost:5173/',
    finalUrl: 'http://localhost:5173/?locale=zh-CN',
  }),
}));

jest.mock(
  '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web',
  () => ({
    loadTradingViewEmbedModule: jest.fn(() => Promise.resolve()),
    preloadTradingViewEmbedBootstrapAssets: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock(
  '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView',
  () => ({
    preloadMarketTradingView: jest.fn(() => Promise.resolve()),
  }),
);

describe('TradingViewEmbedGlobalPreload', () => {
  let idleCallback: IdleRequestCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.history.replaceState({}, '', '/market');
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: jest.fn((callback: IdleRequestCallback) => {
        idleCallback = callback;
        return 1;
      }),
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: jest.fn(),
    });
  });

  test('does not preload TradingView outside Market routes', () => {
    globalThis.history.replaceState({}, '', '/swap');

    const view = render(<TradingViewEmbedGlobalPreload />);

    expect(preloadMarketTradingView).not.toHaveBeenCalled();
    expect(requestIdleCallback).not.toHaveBeenCalled();

    view.unmount();
  });

  test('preloads the app chunk immediately and embed assets when idle', async () => {
    const view = render(<TradingViewEmbedGlobalPreload />);

    await waitFor(() => {
      expect(preloadMarketTradingView).toHaveBeenCalledTimes(1);
      expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 3000,
      });
    });
    expect(loadTradingViewEmbedModule).not.toHaveBeenCalled();
    expect(preloadTradingViewEmbedBootstrapAssets).not.toHaveBeenCalled();

    await act(async () => {
      idleCallback({
        didTimeout: false,
        timeRemaining: () => 10,
      });
      await Promise.resolve();
    });

    expect(loadTradingViewEmbedModule).toHaveBeenCalledWith(
      'http://localhost:5173/',
    );
    expect(preloadTradingViewEmbedBootstrapAssets).toHaveBeenCalledWith(
      'http://localhost:5173/?locale=zh-CN',
    );

    view.unmount();
    expect(cancelIdleCallback).toHaveBeenCalledWith(1);
  });
});
