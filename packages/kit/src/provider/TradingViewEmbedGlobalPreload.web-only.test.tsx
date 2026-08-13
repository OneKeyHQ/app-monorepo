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

import { preloadTasksOnIdle } from './preloadComponents';
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

jest.mock('./preloadComponents', () => ({
  preloadTasksOnIdle: jest.fn(),
}));

describe('TradingViewEmbedGlobalPreload', () => {
  const cleanup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(preloadTasksOnIdle).mockReturnValue(cleanup);
  });

  test('starts first-detail preloads immediately and defers legacy migration', async () => {
    let resolveEmbedModule:
      | ((
          value: Awaited<ReturnType<typeof loadTradingViewEmbedModule>>,
        ) => void)
      | undefined;
    let resolveMarketTradingView: (() => void) | undefined;
    let resolveBootstrapAssets: (() => void) | undefined;
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

    const view = render(<TradingViewEmbedGlobalPreload />);

    await waitFor(() => {
      expect(loadTradingViewEmbedModule).toHaveBeenCalledWith(
        'http://localhost:5173/?locale=zh-CN',
      );
    });
    expect(preloadMarketTradingView).toHaveBeenCalledTimes(1);
    expect(preloadTradingViewEmbedBootstrapAssets).toHaveBeenCalledWith(
      'http://localhost:5173/?locale=zh-CN',
    );
    expect(preloadTasksOnIdle).not.toHaveBeenCalled();
    expect(migrateLegacyTradingViewStorage).not.toHaveBeenCalled();

    await act(async () => {
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

    await waitFor(() => {
      expect(preloadTasksOnIdle).toHaveBeenCalledTimes(1);
    });
    const [tasks, logPrefix] = jest.mocked(preloadTasksOnIdle).mock.calls[0];
    expect(tasks.map((task) => task.name)).toEqual([
      'LegacyTradingViewStorageMigration',
    ]);
    expect(logPrefix).toBe('TradingViewEmbedPreload');

    await Promise.all(tasks.map((task) => task.preload()));

    expect(migrateLegacyTradingViewStorage).toHaveBeenCalledWith(
      'http://localhost:5173/?locale=zh-CN',
    );

    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
