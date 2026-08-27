/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { migrateLegacyTradingViewStorage } from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web';
import { preloadMarketTradingView } from '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView';

import { TradingViewEmbedGlobalPreload } from './TradingViewEmbedGlobalPreload.web-only';

let mockRouteIsFocused = true;

jest.mock('../components/TradingView/hooks/useTradingViewUrl', () => ({
  useTradingViewUrl: () => ({
    baseUrl: 'http://localhost:5173/',
    finalUrl: 'http://localhost:5173/?locale=zh-CN',
  }),
}));

jest.mock('../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('../hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteIsFocused,
}));

jest.mock(
  '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web',
  () => ({
    loadTradingViewEmbedModule: jest.fn(() => Promise.resolve()),
    preloadTradingViewEmbedBootstrapAssets: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock(
  '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web',
  () => ({
    migrateLegacyTradingViewStorage: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock(
  '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView',
  () => ({
    preloadMarketTradingView: jest.fn(() => Promise.resolve()),
  }),
);

describe('TradingViewEmbedGlobalPreload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteIsFocused = true;
    globalThis.history.replaceState(null, '', '/market');
  });

  test('does not preload while a Market screen is unfocused', async () => {
    mockRouteIsFocused = false;

    render(<TradingViewEmbedGlobalPreload />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadTradingViewEmbedModule).not.toHaveBeenCalled();
    expect(preloadMarketTradingView).not.toHaveBeenCalled();
    expect(preloadTradingViewEmbedBootstrapAssets).not.toHaveBeenCalled();
    expect(migrateLegacyTradingViewStorage).not.toHaveBeenCalled();
  });

  test('does not preload from a focused background Market screen on /swap', async () => {
    globalThis.history.replaceState(null, '', '/swap');

    render(<TradingViewEmbedGlobalPreload />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadTradingViewEmbedModule).not.toHaveBeenCalled();
    expect(preloadMarketTradingView).not.toHaveBeenCalled();
    expect(preloadTradingViewEmbedBootstrapAssets).not.toHaveBeenCalled();
    expect(migrateLegacyTradingViewStorage).not.toHaveBeenCalled();
  });

  test('preloads migration and the DOM runtime in parallel', async () => {
    let resolveEmbedModule:
      | ((
          value: Awaited<ReturnType<typeof loadTradingViewEmbedModule>>,
        ) => void)
      | undefined;
    let resolveMarketTradingView: (() => void) | undefined;
    let resolveBootstrapAssets: (() => void) | undefined;
    let resolveLegacyMigration: (() => void) | undefined;
    jest.mocked(loadTradingViewEmbedModule).mockReturnValue(
      new Promise<Awaited<ReturnType<typeof loadTradingViewEmbedModule>>>(
        (resolve) => {
          resolveEmbedModule = resolve;
        },
      ),
    );
    jest.mocked(preloadMarketTradingView).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveMarketTradingView = resolve;
      }),
    );
    jest.mocked(preloadTradingViewEmbedBootstrapAssets).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveBootstrapAssets = resolve;
      }),
    );
    jest.mocked(migrateLegacyTradingViewStorage).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLegacyMigration = resolve;
      }),
    );

    render(<TradingViewEmbedGlobalPreload />);

    await waitFor(() => {
      expect(preloadMarketTradingView).toHaveBeenCalledTimes(1);
      expect(loadTradingViewEmbedModule).toHaveBeenCalledWith(
        'http://localhost:5173/?locale=zh-CN',
      );
      expect(preloadTradingViewEmbedBootstrapAssets).toHaveBeenCalledWith(
        'http://localhost:5173/?locale=zh-CN',
      );
      expect(migrateLegacyTradingViewStorage).toHaveBeenCalledWith(
        'http://localhost:5173/?locale=zh-CN',
      );
    });

    await act(async () => {
      resolveLegacyMigration?.();
      resolveEmbedModule?.({
        assetBaseUrl: 'http://localhost:5173/',
        module: {
          mountTradingView: jest.fn(),
          postTradingViewMessage: jest.fn(),
        },
      });
      resolveMarketTradingView?.();
      resolveBootstrapAssets?.();
      await Promise.resolve();
    });
  });
});
